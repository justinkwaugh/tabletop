import { describe, expect, it } from 'vitest'
import {
    assertExists,
    Color,
    latestPlayerUndoTarget,
    type GameAction,
    type Visibility
} from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from './searchResolve.js'
import { AnswerQuestion, HydratedAnswerQuestion } from './answerQuestion.js'
import { PlayerStatus, Region } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, region, yes } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { answerQuestion } from '../testing/steps.js'
import { FILLER } from '../testing/cards.js'
import { isVision } from '../data/cardRegistry.js'
import { FALSE_PROPHET_ID } from '../util/revealedVision.js'
import { becomeCitizen } from '../util/citizenship.js'
import type { ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// False Prophet: "If it is ever discarded, kill the warband and play or discard the Vision as if you had searched."
// Law 6.1 reads "as if you searched" with "(Restrictions and modifiers apply.)", and Forced Labor's Q&A on a
// facedown play says the modifiers do apply. So from revision 32 the play or discard takes the Search modifiers
// that act on it (the Cracked Horn, Bracken) and Forced Labor's toll; if the toll cannot be paid, the warband dies
// and the Vision goes to the usual discard pile. Before it, a game keeps the answers it was recorded with.

const HORN = 'relic.cracked-horn'
const BRACKEN = 'denizen.beast.bracken'
const FORCED_LABOR = 'denizen.order.forced-labor'
const SECRET_POLICE = 'denizen.order.secret-police'
const AUGURY = 'denizen.arcane.augury'
const FAITH = 'vision.faith'
const CONQUEST = 'vision.conquest'
const SANCTUARY = 'vision.sanctuary'

const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const FIXED = OathRevision.EngineFixes27
const BEFORE = OathRevision.EngineFixes26

const HORN_USE = modifierUse(HORN)
const BRACKEN_CRADLE_BOTTOM = modifierUse(BRACKEN, [region(Region.Cradle), yes])
const BRACKEN_HINTERLAND_TOP = modifierUse(BRACKEN, [region(Region.Hinterland)])

const rhysView: Visibility.Perspective = { kind: 'player', playerId: RHYS }
const danaView: Visibility.Perspective = { kind: 'player', playerId: DANA }

const NO_FAVOR = 'no favor for the toll: the Vision goes to the usual discard pile'

interface Table {
    revision?: OathRevision
    /** Rhys's favor; 1 pays Forced Labor's toll. */
    favor?: number
    /** Forced Labor at the River, where Rhys stands. */
    forcedLabor?: boolean
    /** The River held by the bandits rather than by Ann's Imperial warbands. */
    bandits?: boolean
    /** Dana's site: in the Cradle (c1) unless given. */
    danaSite?: string
    /** Rhys's own revealed Vision, if any. */
    rhysVision?: string
    /** Secret Police at the River beside Forced Labor, so Ann's enemies play no Vision faceup there. */
    secretPolice?: boolean
}

/**
 * Dana (an Exile) stands at `danaSite`, which they rule; their revealed Vision is the Vision of Faith, with one of
 * Rhys's warbands on it (False Prophet). Rhys (an Exile) has False Prophet and Bracken faceup, holds the Cracked
 * Horn, and stands at the River (c2, the Cradle), which Ann, the Chancellor, rules with Imperial warbands; Forced
 * Labor is there, so Rhys, Ann's enemy, owes her a favor to search there. The world deck's top is the Vision of
 * Conquest.
 */
function table({
    revision = FIXED,
    favor = 1,
    forcedLabor = true,
    bandits = false,
    danaSite = 'c1',
    rhysVision,
    secretPolice = false
}: Table = {}): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: danaSite,
                favor: 3,
                secrets: 2,
                supply: 6,
                revealedVisionId: FAITH,
                warbandsInPersonalBank: { [DANA]: 10 }
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Blue,
                siteId: 'c2',
                favor,
                secrets: 2,
                supply: 5,
                relicIds: [HORN],
                advisers: [FALSE_PROPHET_ID, BRACKEN].map((cardId) => ({ cardId, faceUp: true })),
                warbandsInPersonalBank: { [RHYS]: 10 },
                ...(rhysVision ? { revealedVisionId: rhysVision } : {})
            }),
            testPlayer({
                playerId: ANN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: bandits ? 'h1' : 'c2',
                favor: 2,
                secrets: 1,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 }
            })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: ANN,
            denizensBySite: {
                c1: [],
                c2: [
                    ...(forcedLabor ? [FORCED_LABOR] : []),
                    ...(secretPolice ? [SECRET_POLICE] : [])
                ],
                p1: [],
                h1: []
            },
            warbandsBySite: {
                [danaSite]: { [DANA]: 1 },
                ...(bandits ? {} : { c2: { [IMPERIAL_WARBANDS]: 2 } })
            },
            warbandsOnCards: { [FAITH]: { [RHYS]: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, DANA)
    const vault = s.requireVault()
    vault.worldDeck = [CONQUEST, FILLER]
    s.worldDeckVisions = 1
    // The Cradle pile holds one card, so its bottom differs from its top.
    vault.discardPiles[Region.Cradle] = ['denizen.beast.wolves']
    s.discardPileCounts[Region.Cradle] = 1
    return s
}

const SEARCH = buildAction(Search, {
    playerId: DANA,
    drawFrom: SearchSource.WorldDeck,
    revealsInfo: true
})
const REVEAL_CONQUEST = buildAction(SearchResolve, {
    playerId: DANA,
    keptCardId: CONQUEST,
    discardOrder: [],
    play: SearchPlay.RevealedVision
})

/** Dana's Search reveals the Vision of Conquest, so Faith is discarded and False Prophet asks Rhys. */
function asked(t: Table = {}): HydratedOathGameState {
    const s = table(t)
    new HydratedSearch(SEARCH).apply(s)
    new HydratedSearchResolve(REVEAL_CONQUEST).apply(s)
    return s
}

function answer(play: SearchPlay, modifiers: ModifierUse[] = []): QuestionAnswer {
    return {
        kind: PowerQuestionKind.PlayOrDiscardVision,
        play,
        ...(modifiers.length > 0 ? { modifiers } : {})
    }
}

const reasonOf = (s: HydratedOathGameState, play: SearchPlay, modifiers: ModifierUse[] = []) =>
    HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, answer(play, modifiers))

/** Rhys's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, rhysView)), rhysView)

const pile = (s: HydratedOathGameState, r: Region) => s.requireVault().discardPiles[r]
const worldDeck = (s: HydratedOathGameState) => s.requireVault().worldDeck

/** R-9.4 — the public counts agree with the vault the host keeps. */
function expectVaultMatchesTable(s: HydratedOathGameState) {
    const vault = s.requireVault()
    for (const r of [Region.Cradle, Region.Provinces, Region.Hinterland])
        expect(vault.discardPiles[r]).toHaveLength(s.discardPileCounts[r])
    expect(vault.worldDeck.filter(isVision)).toHaveLength(s.worldDeckVisions)
}

describe("False Prophet's play or discard takes the Search modifiers and Forced Labor's toll (from revision 32)", () => {
    it('the scene: Faith is discarded by Dana’s Search, its warband died, and Rhys is asked', () => {
        const s = asked()
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
        expect(s.warbandsOnCard(FAITH)).toEqual({ [RHYS]: 0 })
        expect(s.pendingQuestions?.queue).toEqual([
            {
                kind: PowerQuestionKind.PlayOrDiscardVision,
                cardId: FALSE_PROPHET_ID,
                askedPlayerId: RHYS,
                visionCardId: FAITH
            }
        ])
        expect(s.getPlayerState(RHYS).favor).toBe(1)
    })

    it('discarded with nothing in use: the usual pile, and Rhys pays Ann 1 favor (Forced Labor)', () => {
        const s = asked()
        expect(reasonOf(s, SearchPlay.Discard)).toBeUndefined()
        const action = answerQuestion(s, RHYS, answer(SearchPlay.Discard))
        expect(pile(s, Region.Provinces)).toEqual([FAITH])
        expect(s.getPlayerState(RHYS).favor).toBe(0)
        expect(s.getPlayerState(ANN).favor).toBe(3)
        const meta = action.metadata
        assertExists(meta, 'The answer records what it did')
        expect(meta.discardedCardIds).toEqual([FAITH])
        expect(meta.discardPileRegion).toBe(Region.Provinces)
        expect(meta.tollsPaid).toEqual([`${FORCED_LABOR}: gave a favor to ${ANN}`])
        expect(meta.modifiers).toBeUndefined()
        expect(meta.discardToBottom).toBeUndefined()
        expect(meta.discardToWorldDeck).toBeUndefined()
        expect(meta.tollsUnpaid).toBeUndefined()
        expectVaultMatchesTable(s)
    })

    it('with the Cracked Horn: under the world deck, in the vault too, and nothing stays in use', () => {
        const s = asked()
        expect(reasonOf(s, SearchPlay.Discard, [HORN_USE])).toBeUndefined()
        const action = answerQuestion(s, RHYS, answer(SearchPlay.Discard, [HORN_USE]))
        expect(worldDeck(s).at(-1)).toBe(FAITH)
        expect(pile(s, Region.Provinces)).toEqual([])
        expect(s.getPlayerState(RHYS).favor).toBe(0)
        expect(s.getPlayerState(ANN).favor).toBe(3)
        expect(action.metadata?.modifiers).toEqual([HORN])
        expect(action.metadata?.discardToWorldDeck).toBe(true)
        expect(action.metadata?.tollsPaid).toEqual([`${FORCED_LABOR}: gave a favor to ${ANN}`])
        expect(s.searchModifiersInUse).toBeUndefined()
        expectVaultMatchesTable(s)
    })

    it('with Bracken (the Cradle, bottom): the bottom of the Cradle pile', () => {
        const s = asked()
        expect(reasonOf(s, SearchPlay.Discard, [BRACKEN_CRADLE_BOTTOM])).toBeUndefined()
        const action = answerQuestion(s, RHYS, answer(SearchPlay.Discard, [BRACKEN_CRADLE_BOTTOM]))
        expect(pile(s, Region.Cradle)).toEqual(['denizen.beast.wolves', FAITH])
        expect(pile(s, Region.Provinces)).toEqual([])
        expect(action.metadata?.modifiers).toEqual([BRACKEN])
        expect(action.metadata?.discardPileRegion).toBe(Region.Cradle)
        expect(action.metadata?.discardToBottom).toBe(true)
        expect(s.getPlayerState(RHYS).favor).toBe(0)
        expect(s.searchModifiersInUse).toBeUndefined()
        expectVaultMatchesTable(s)
    })

    it('with Bracken (the Hinterland, top): the top of the Hinterland pile', () => {
        const s = asked()
        answerQuestion(s, RHYS, answer(SearchPlay.Discard, [BRACKEN_HINTERLAND_TOP]))
        expect(pile(s, Region.Hinterland)).toEqual([FAITH])
        expectVaultMatchesTable(s)
    })

    it('the Horn and Bracken together: refused (R-7.4-H2), and nothing is paid', () => {
        const s = asked()
        expect(reasonOf(s, SearchPlay.Discard, [HORN_USE, BRACKEN_CRADLE_BOTTOM])).toContain(
            'R-7.4-H2'
        )
    })

    it('played as Rhys’s Vision with the Horn: accepted; nothing is discarded, and the toll is paid', () => {
        const s = asked()
        expect(reasonOf(s, SearchPlay.RevealedVision, [HORN_USE])).toBeUndefined()
        const action = answerQuestion(s, RHYS, answer(SearchPlay.RevealedVision, [HORN_USE]))
        expect(s.getPlayerState(RHYS).revealedVisionId).toBe(FAITH)
        expect(action.metadata?.discardedCardIds).toBeUndefined()
        expect(action.metadata?.modifiers).toEqual([HORN])
        expect(s.getPlayerState(ANN).favor).toBe(3)
        expectVaultMatchesTable(s)
    })

    it('played over Rhys’s own revealed Vision with the Horn: that Vision goes under the world deck (R-5.1.4.III)', () => {
        const s = asked({ rhysVision: SANCTUARY })
        answerQuestion(s, RHYS, answer(SearchPlay.RevealedVision, [HORN_USE]))
        expect(s.getPlayerState(RHYS).revealedVisionId).toBe(FAITH)
        expect(worldDeck(s).at(-1)).toBe(SANCTUARY)
        expectVaultMatchesTable(s)
    })

    it('a question the play asks keeps the Horn in use beside the cards Dana’s Search keeps in use (R-7.4.3)', () => {
        const s = asked({ rhysVision: SANCTUARY })
        // Dana's warband on Rhys's own Vision: replaced, it asks Dana in turn. Dana's Search held Augury in use.
        s.warbandsOnCards = { ...s.warbandsOnCards, [SANCTUARY]: { [DANA]: 1 } }
        const pending = s.pendingQuestions
        assertExists(pending, 'Rhys is asked')
        pending.searchModifiersInUse = [AUGURY]
        answerQuestion(s, RHYS, answer(SearchPlay.RevealedVision, [HORN_USE]))
        expect(s.pendingQuestions?.queue).toEqual([
            expect.objectContaining({ askedPlayerId: DANA, visionCardId: SANCTUARY })
        ])
        expect(s.pendingQuestions?.searchModifiersInUse).toEqual([AUGURY, HORN])
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('played as a facedown adviser with the Horn: accepted', () => {
        const s = asked()
        expect(reasonOf(s, SearchPlay.Adviser, [HORN_USE])).toBeUndefined()
        answerQuestion(s, RHYS, answer(SearchPlay.Adviser, [HORN_USE]))
        expect(s.getPlayerState(RHYS).knownAdviser(FAITH)?.faceUp).toBe(false)
        expect(s.getPlayerState(RHYS).favor).toBe(0)
    })

    it('Secret Police at Ann’s site: "as your Vision" is refused there, and the Horn’s discard is not', () => {
        const s = asked({ secretPolice: true })
        expect(reasonOf(s, SearchPlay.RevealedVision, [HORN_USE])).toContain('Secret Police')
        expect(reasonOf(s, SearchPlay.RevealedVision)).toContain('Secret Police')
        expect(reasonOf(s, SearchPlay.Discard, [HORN_USE])).toBeUndefined()
    })

    it('a card that changes the draw is refused: the play draws nothing', () => {
        const s = asked()
        expect(reasonOf(s, SearchPlay.Discard, [modifierUse(AUGURY)])).toBeDefined()
    })

    it('the bandits rule Forced Labor’s site: the favor is burned', () => {
        const s = asked({ bandits: true })
        const action = answerQuestion(s, RHYS, answer(SearchPlay.Discard))
        expect(s.getPlayerState(RHYS).favor).toBe(0)
        expect(s.getPlayerState(ANN).favor).toBe(2)
        expect(action.metadata?.tollsPaid).toEqual([
            `${FORCED_LABOR}: burned a favor for the bandits`
        ])
    })

    it('without Forced Labor: no toll', () => {
        const s = asked({ forcedLabor: false })
        const action = answerQuestion(s, RHYS, answer(SearchPlay.Discard, [HORN_USE]))
        expect(s.getPlayerState(RHYS).favor).toBe(1)
        expect(action.metadata?.tollsPaid).toBeUndefined()
        expect(worldDeck(s).at(-1)).toBe(FAITH)
    })

    it('the usual pile is the asked player’s: Rhys in the Cradle, Dana in the Provinces', () => {
        const s = asked({ danaSite: 'p1' })
        answerQuestion(s, RHYS, answer(SearchPlay.Discard))
        expect(pile(s, Region.Provinces)).toEqual([FAITH])
        expect(pile(s, Region.Hinterland)).toEqual([])
        expectVaultMatchesTable(s)
    })
})

describe('with no favor for Forced Labor, only the plain discard is left', () => {
    it('Discard is accepted and pays nothing; the Vision goes to the usual pile, and the record says why', () => {
        const s = asked({ favor: 0 })
        expect(reasonOf(s, SearchPlay.Discard)).toBeUndefined()
        const action = answerQuestion(s, RHYS, answer(SearchPlay.Discard))
        expect(pile(s, Region.Provinces)).toEqual([FAITH])
        expect(s.getPlayerState(ANN).favor).toBe(2)
        expect(action.metadata?.tollsPaid).toBeUndefined()
        expect(action.metadata?.tollsUnpaid).toEqual([FORCED_LABOR])
        expect(action.metadata?.discardPileRegion).toBe(Region.Provinces)
        expectVaultMatchesTable(s)
    })

    it('the Horn, Bracken, "as your Vision" and the facedown adviser are refused', () => {
        const s = asked({ favor: 0 })
        expect(reasonOf(s, SearchPlay.Discard, [HORN_USE])).toBe(NO_FAVOR)
        expect(reasonOf(s, SearchPlay.Discard, [BRACKEN_CRADLE_BOTTOM])).toBe(NO_FAVOR)
        expect(reasonOf(s, SearchPlay.RevealedVision)).toBe(NO_FAVOR)
        expect(reasonOf(s, SearchPlay.Adviser)).toBe(NO_FAVOR)
    })
})

describe('on a player’s own view (safe on a player’s view)', () => {
    it('Rhys’s view gives the same answers, with the state neither copied nor changed', () => {
        const s = asked()
        const server = JSON.stringify(s.dehydrate())
        const own = ownView(s)
        expect(reasonOf(own, SearchPlay.Discard)).toBeUndefined()
        expect(reasonOf(own, SearchPlay.Discard, [HORN_USE])).toBeUndefined()
        expect(reasonOf(own, SearchPlay.Discard, [BRACKEN_CRADLE_BOTTOM])).toBeUndefined()
        expect(reasonOf(own, SearchPlay.Discard, [HORN_USE, BRACKEN_CRADLE_BOTTOM])).toContain(
            'R-7.4-H2'
        )
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    it('with no favor, Rhys’s view also leaves only the plain discard', () => {
        const own = ownView(asked({ favor: 0 }))
        expect(reasonOf(own, SearchPlay.Discard)).toBeUndefined()
        expect(reasonOf(own, SearchPlay.Discard, [HORN_USE])).toBe(NO_FAVOR)
    })
})

describe('through the engine: the record, the vault and Undo', () => {
    const game = testGame([DANA, RHYS, ANN])
    function run(t: Table, reply: QuestionAnswer) {
        let state: OathProjectedState = table(t).dehydrate()
        const history: GameAction[] = []
        for (const action of [SEARCH, REVEAL_CONQUEST]) {
            const result = engine.runNext(action, state, game)
            history.push(...result.processedActions)
            state = result.updatedState
        }
        const question = state.pendingQuestions?.queue[0]
        // The question Dana sees is the same one: Rhys has declared nothing until they answer.
        expect(served(state, danaView).pendingQuestions?.queue[0]).toEqual(question)
        const action = buildAction(AnswerQuestion, { playerId: RHYS, answer: reply })
        const result = engine.runNext(action, state, game)
        history.push(...result.processedActions)
        const recorded = result.processedActions.find(
            (a) => a.type === action.type && a.playerId === RHYS
        )
        assertExists(recorded, 'The engine records the answer')
        return { after: new HydratedOathGameState(result.updatedState), recorded, history }
    }

    it('the Horn: the vault puts Faith under the world deck, Dana is told where and what was paid, and Undo is not offered', () => {
        const { after, recorded, history } = run({}, answer(SearchPlay.Discard, [HORN_USE]))
        expect(after.requireVault().worldDeck.at(-1)).toBe(FAITH)
        expectVaultMatchesTable(after)
        const theirs = OathVisibility.actions.project(recorded, danaView)
        expect(theirs).toHaveProperty('metadata.modifiers', [HORN])
        expect(theirs).toHaveProperty('metadata.discardToWorldDeck', true)
        expect(theirs).toHaveProperty('metadata.tollsPaid', [
            `${FORCED_LABOR}: gave a favor to ${ANN}`
        ])
        expect(recorded.revealsInfo).toBe(true)
        expect(latestPlayerUndoTarget(history, RHYS)).toBeUndefined()
    })

    it('Bracken: the vault puts Faith at the bottom of the Cradle pile', () => {
        const { after } = run({}, answer(SearchPlay.Discard, [BRACKEN_CRADLE_BOTTOM]))
        expect(after.requireVault().discardPiles[Region.Cradle]).toEqual([
            'denizen.beast.wolves',
            FAITH
        ])
        expectVaultMatchesTable(after)
    })
})

describe('a Citizenship that discards the revealed Vision', () => {
    it('asks Rhys the same question, and the Horn takes the discard', () => {
        const s = table()
        s.getPlayerState(DANA).supply = 6
        becomeCitizen(s, DANA)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.PlayOrDiscardVision,
            askedPlayerId: RHYS,
            visionCardId: FAITH
        })
        answerQuestion(s, RHYS, answer(SearchPlay.Discard, [HORN_USE]))
        expect(worldDeck(s).at(-1)).toBe(FAITH)
        expect(s.getPlayerState(RHYS).favor).toBe(0)
    })
})

describe('before revision 32 a game keeps the answers it was recorded with', () => {
    it('a card declared is refused', () => {
        const s = asked({ revision: BEFORE })
        expect(reasonOf(s, SearchPlay.Discard, [HORN_USE])).toBe(
            'in a game created before revision 32, no Search modifier applies to False Prophet’s play or discard'
        )
    })

    it('the plain discard pays no toll and goes to the usual pile', () => {
        const s = asked({ revision: BEFORE })
        const action = answerQuestion(s, RHYS, answer(SearchPlay.Discard))
        expect(s.getPlayerState(RHYS).favor).toBe(1)
        expect(pile(s, Region.Provinces)).toEqual([FAITH])
        expect(action.metadata?.tollsPaid).toBeUndefined()
    })

    it('with no favor every play is still accepted, as before', () => {
        const s = asked({ revision: BEFORE, favor: 0 })
        expect(reasonOf(s, SearchPlay.RevealedVision)).toBeUndefined()
        expect(reasonOf(s, SearchPlay.Adviser)).toBeUndefined()
    })
})

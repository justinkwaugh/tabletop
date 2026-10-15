import { describe, expect, it } from 'vitest'
import { HydratedSearch, Search, SearchSource } from '../actions/search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import {
    HydratedPlayFacedownAdviser,
    PlayFacedownAdviser
} from '../actions/playFacedownAdviser.js'
import { ActionSource } from '@tabletop/common'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { type UseActionPower } from '../actions/useActionPower.js'
import { powerIndexOf, PowerTiming } from '../data/cardPowers.js'
import { ActionType } from '../definition/actions.js'
import { OathRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { OathTestEngine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import '../powers/index.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, card, modifierUse, player } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { answerQuestion, playDrawnCard } from '../testing/steps.js'
import { adviser, rulerTable } from '../testing/tables.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { adviserLimitDiscardCount, adviserLimitDiscards } from './adviserLimit.js'
import { adviserDiscardsNeeded, reasonCannotPlayCard } from './cardPlay.js'
import { advisersOverLimit, advisersTowardLimit } from './continuous.js'
import { reasonExchangeInvalid } from './exchange.js'
import { currentQuestion } from './questions.js'
import { OathRevision } from './revision.js'

const PIPER = 'denizen.beast.pied-piper'
const WAGON = 'denizen.nomad.family-wagon'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'
const ELDERS = 'denizen.nomad.elders'
const STEED = 'denizen.nomad.a-fast-steed'

/** 'ruler' holds `advisers` faceup; 'other' holds Tents; the game keeps the rules of `revision`. */
function table(
    advisers: string[],
    revision: OathRevision = OathRevision.EngineFixes7,
    over: Record<string, Record<string, unknown>> = {}
) {
    return rulerTable([], advisers, over, { oathRevision: revision })
}

/** The ruler's own view, as the table builds it from what the server sends. */
function ownView(s: HydratedOathGameState, playerId = 'ruler'): HydratedOathGameState {
    return new HydratedOathGameState(served(s, { kind: 'player', playerId }))
}

// Pied Piper: "This card ignores the adviser limit." Its Q&A: "it does not prompt a discard when you
// play it, but it still counts toward your total number of advisers."
describe('Pied Piper counts toward the adviser limit once held (revision 11)', () => {
    it('a holder of Pied Piper and two advisers counts three', () => {
        expect(advisersTowardLimit(table([PIPER, WOLVES, INN]), 'ruler')).toBe(3)
    })

    it('a Search play to the advisers must discard to keep a fourth (its Q&A)', () => {
        expect(() => playDrawnCard(table([PIPER, WOLVES, INN]), SCOUTS, SearchPlay.Adviser)).toThrow(
            /already at the adviser limit of 3/
        )
        const s = table([PIPER, WOLVES, INN])
        s.getPlayerState('ruler').handIds = [SCOUTS, FILLER]
        new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: 'ruler',
                keptCardId: SCOUTS,
                discardOrder: [FILLER],
                play: SearchPlay.Adviser,
                faceUp: true,
                discardedAdviserCardIds: [PIPER]
            })
        ).apply(s)
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WOLVES, INN, SCOUTS])
    })

    it('a facedown play counts the same', () => {
        const s = table([PIPER, WOLVES, INN])
        expect(adviserDiscardsNeeded(s, 'ruler', SCOUTS, { faceUp: false })).toBe(1)
    })

    it('Pied Piper played over three advisers is kept with no discard (its own arrival)', () => {
        const s = table([WOLVES, INN, SCOUTS])
        expect(adviserDiscardsNeeded(s, 'ruler', PIPER, { faceUp: true })).toBe(0)
        playDrawnCard(s, PIPER, SearchPlay.Adviser)
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WOLVES, INN, SCOUTS, PIPER])
        expect(advisersTowardLimit(s, 'ruler')).toBe(4)
    })

    it('Pied Piper played facedown has no power, so it counts and prompts the discard', () => {
        const s = table([WOLVES, INN, SCOUTS])
        expect(adviserDiscardsNeeded(s, 'ruler', PIPER, { faceUp: false })).toBe(1)
    })

    it('a facedown Pied Piper turned faceup is played, so it prompts no discard', () => {
        const s = table([], OathRevision.EngineFixes7, {
            ruler: { advisers: [adviser(WOLVES), adviser(INN), adviser(SCOUTS), adviser(PIPER, false)] }
        })
        expect(adviserDiscardsNeeded(s, 'ruler', PIPER, { faceUp: true, fromAdvisers: true })).toBe(0)
    })

    it('a facedown adviser turned faceup beside Pied Piper keeps the count it had', () => {
        const s = table([], OathRevision.EngineFixes7, {
            ruler: { advisers: [adviser(PIPER), adviser(WOLVES, false), adviser(INN)] }
        })
        expect(adviserDiscardsNeeded(s, 'ruler', WOLVES, { faceUp: true, fromAdvisers: true })).toBe(0)
        new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, { playerId: 'ruler', cardId: WOLVES, play: SearchPlay.Adviser })
        ).apply(s)
        expect([...s.getPlayerState('ruler').faceupAdviserIds()].sort()).toEqual([INN, PIPER, WOLVES].sort())
    })

    it("Pied Piper's Action moves it to a player with three advisers: no discard there, and their next adviser play discards down to the limit", () => {
        const s = table([PIPER], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(TENTS), adviser(WOLVES), adviser(INN)] }
        })
        actionPowerUse('ruler', PIPER, [player('other')]).apply(s)
        expect(currentQuestion(s)).toBeUndefined()
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([TENTS, WOLVES, INN, PIPER])
        expect(advisersTowardLimit(s, 'other')).toBe(4)
        // Four held and one more played: two go to meet the limit of three (R-7.6.4).
        expect(adviserDiscardsNeeded(s, 'other', SCOUTS, { faceUp: true })).toBe(2)
        expect(() => playDrawnCard(s, SCOUTS, SearchPlay.Adviser, undefined, 'other')).toThrow(
            /2 advisers must be discarded first/
        )
    })

    it('Family Wagon played after Pied Piper keeps Pied Piper or one other non-Nomad (Family Wagon Q&A)', () => {
        const s = table([PIPER, WOLVES])
        expect(adviserDiscardsNeeded(s, 'ruler', WAGON, { faceUp: true })).toBe(1)
        for (const kept of [PIPER, WOLVES]) {
            const t = table([PIPER, WOLVES])
            const gone = kept === PIPER ? WOLVES : PIPER
            expect(
                reasonCannotPlayCard(t, 'ruler', WAGON, SearchPlay.Adviser, {
                    faceUp: true,
                    discardedAdviserCardIds: [gone]
                })
            ).toBeUndefined()
        }
    })

    it('Pied Piper may always be played after Family Wagon (Family Wagon Q&A)', () => {
        const s = table([WAGON, WOLVES, ELDERS])
        expect(adviserDiscardsNeeded(s, 'ruler', PIPER, { faceUp: true })).toBe(0)
        playDrawnCard(s, PIPER, SearchPlay.Adviser)
        // Held, it is a second non-Nomad: the next non-Nomad play discards down to one.
        expect(adviserDiscardsNeeded(s, 'ruler', SCOUTS, { faceUp: true })).toBe(2)
        // A Nomad still ignores the limit.
        expect(adviserDiscardsNeeded(s, 'ruler', 'denizen.nomad.a-fast-steed', { faceUp: true })).toBe(1)
    })

    it("Land Warden's second card to the advisers is refused over Pied Piper and two others, as over any three", () => {
        const s = table([LAND_WARDEN, PIPER, WOLVES])
        s.denizensBySite = { c1: [], c2: [], p1: [], h1: [] }
        s.requireVault().worldDeck = [INN, SCOUTS, FILLER]
        new HydratedSearch(
            buildAction(Search, {
                playerId: 'ruler',
                drawFrom: SearchSource.WorldDeck,
                revealsInfo: true,
                modifiers: [modifierUse(LAND_WARDEN)]
            })
        ).apply(s)
        const choice = {
            keptCardId: INN,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            secondPlay: { cardId: SCOUTS, play: SearchPlay.Adviser, faceUp: true }
        }
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', choice)).toMatch(/adviser limit/)
    })

    it('The Gathering: a holder of Pied Piper and two advisers cannot take a fourth (its Q&A)', () => {
        const s = table([SCOUTS], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(PIPER), adviser(WOLVES), adviser(INN)] }
        })
        expect(reasonExchangeInvalid(s, 'ruler', 'other', { fromProposer: { adviserRows: [0] } })).toMatch(
            /cannot hold 1 more advisers/
        )
    })

    it('Pied Piper given in an exchange to a player with three advisers is not counted on its arrival', () => {
        const s = table([PIPER], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(TENTS), adviser(WOLVES), adviser(INN)] }
        })
        expect(reasonExchangeInvalid(s, 'ruler', 'other', { fromProposer: { adviserRows: [0] } })).toBeUndefined()
    })

    it("the count and the discards needed read the same on the player's own view as on the server", () => {
        const scenes = [
            table([PIPER, WOLVES, INN]),
            table([WOLVES, INN, SCOUTS]),
            table([PIPER, WOLVES]),
            table([], OathRevision.EngineFixes7, {
                ruler: { advisers: [adviser(PIPER), adviser(WOLVES, false), adviser(INN)] }
            })
        ]
        for (const s of scenes) {
            const own = ownView(s)
            expect(advisersTowardLimit(own, 'ruler')).toBe(advisersTowardLimit(s, 'ruler'))
            for (const cardId of [SCOUTS, PIPER, WAGON]) {
                for (const faceUp of [true, false]) {
                    expect(adviserDiscardsNeeded(own, 'ruler', cardId, { faceUp })).toBe(
                        adviserDiscardsNeeded(s, 'ruler', cardId, { faceUp })
                    )
                }
            }
            // Another player's count reads only what is public.
            const theirs = ownView(s, 'other')
            expect(advisersTowardLimit(theirs, 'ruler')).toBe(advisersTowardLimit(s, 'ruler'))
        }
    })
})

// A fourth adviser kept over Pied Piper and two others before revision 11: `powers/cardAndPawnMoves.spec.ts`.
describe('before revision 11 a game keeps the count it was recorded with', () => {
    it('Family Wagon played after Pied Piper kept both', () => {
        expect(adviserDiscardsNeeded(table([PIPER, WOLVES], OathRevision.EngineFixes6), 'ruler', WAGON, { faceUp: true })).toBe(0)
    })

    it('The Gathering gave a holder of Pied Piper and two advisers a fourth', () => {
        const s = table([SCOUTS], OathRevision.EngineFixes6, {
            other: { advisers: [adviser(PIPER), adviser(WOLVES), adviser(INN)] }
        })
        expect(reasonExchangeInvalid(s, 'ruler', 'other', { fromProposer: { adviserRows: [0] } })).toBeUndefined()
    })
})

const ENCHANTRESS = 'denizen.discord.enchantress'
const TWIN = 'denizen.nomad.twin-brother'
const HORNED = 'relic.horned-mask'
const FALSE_PROPHET = 'denizen.discord.false-prophet'

function discards(...discardedAdviserCardIds: string[]): QuestionAnswer {
    return { kind: PowerQuestionKind.DiscardAdvisers, discardedAdviserCardIds }
}

function pileTotal(s: HydratedOathGameState): number {
    return Object.values(s.discardPileCounts).reduce((sum, n) => sum + n, 0)
}

// Enchantress's Q&A: "If I swap this for the Pied Piper and they already have four cards, what happens?"
// "They will need to discard a card from their advisers, but not the Enchantress." Law 7.6.4: a
// changed limit is met by discarding down to it.
describe('a swap that leaves a player over the adviser limit asks them to discard down (revision 11)', () => {
    it('Enchantress swapped for Pied Piper: its holder discards one, never the Enchantress', () => {
        const s = table([ENCHANTRESS], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(WOLVES), adviser(INN), adviser(FALSE_PROPHET), adviser(PIPER)] }
        })
        actionPowerUse('ruler', ENCHANTRESS, [card(PIPER)]).apply(s)
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([PIPER])
        expect(s.pendingQuestions?.queue).toEqual([
            {
                kind: PowerQuestionKind.DiscardAdvisers,
                cardId: ENCHANTRESS,
                askedPlayerId: 'other',
                actingPlayerId: 'ruler',
                count: 1,
                receivedCardIds: [ENCHANTRESS]
            }
        ])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', discards(ENCHANTRESS))).toMatch(/just received/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', discards(FALSE_PROPHET))).toMatch(/locked/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', discards())).toMatch(/still over the adviser limit/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', discards(WOLVES, INN))).toMatch(/only 1 adviser/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', discards(PIPER))).toMatch(/other's to answer/)
        expect(adviserLimitDiscards(s, 'other')).toEqual([WOLVES, INN])
        const before = pileTotal(s)
        const answered = answerQuestion(s, 'other', discards(WOLVES))
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([INN, FALSE_PROPHET, ENCHANTRESS])
        expect(pileTotal(s)).toBe(before + 1)
        expect(answered.metadata?.summary).toBe(`discarded ${WOLVES} to meet the adviser limit`)
        expect(s.pendingQuestions?.queue).toEqual([])
    })

    it('through the engine the turn holds for the asked player and resumes once they discard', () => {
        const engine = new OathTestEngine(OathRuntime)
        const game = testGame(['ruler', 'other', 'away'])
        let seq = 0
        const stamp = (index: number) => ({ id: `settle-${(seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index })
        let state = table([ENCHANTRESS], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(WOLVES), adviser(INN), adviser(SCOUTS), adviser(PIPER)] },
            away: { status: PlayerStatus.Chancellor }
        }).dehydrate()
        const use: UseActionPower = {
            ...stamp(state.actionCount),
            type: ActionType.UseActionPower,
            playerId: 'ruler',
            cardId: ENCHANTRESS,
            powerIndex: powerIndexOf(ENCHANTRESS, PowerTiming.Action),
            choices: [card(PIPER)]
        }
        state = engine.run(use, state, game).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual(['other'])
        expect(engine.getValidActionTypesForPlayer(game, state, 'other')).toContain(ActionType.AnswerQuestion)
        expect(engine.getValidActionTypesForPlayer(game, state, 'ruler')).not.toContain(ActionType.AnswerQuestion)
        const reply: AnswerQuestion = { ...stamp(state.actionCount), type: ActionType.AnswerQuestion, playerId: 'other', answer: discards(INN) }
        state = engine.run(reply, state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['ruler'])
        expect(state.pendingQuestions).toBeUndefined()
    })

    it('a facedown adviser may go, and the record does not name it', () => {
        const s = table([ENCHANTRESS], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(WOLVES, false), adviser(INN), adviser(SCOUTS), adviser(PIPER)] }
        })
        actionPowerUse('ruler', ENCHANTRESS, [card(PIPER)]).apply(s)
        expect(adviserLimitDiscards(s, 'other')).toEqual([WOLVES, INN, SCOUTS])
        const answered = answerQuestion(s, 'other', discards(WOLVES))
        expect(answered.metadata?.summary).toBe('discarded 1 facedown adviser to meet the adviser limit')
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([INN, SCOUTS, ENCHANTRESS])
    })

    it('Enchantress swapped for Family Wagon: both sides are over, asked in turn order from its user, and neither discards the card received', () => {
        const s = table([ENCHANTRESS, WOLVES, INN], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(WAGON), adviser(TENTS), adviser(ELDERS), adviser(SCOUTS)] }
        })
        actionPowerUse('ruler', ENCHANTRESS, [card(WAGON)]).apply(s)
        expect(s.pendingQuestions?.queue.map((q) => q.askedPlayerId)).toEqual(['ruler', 'other'])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', discards(WAGON))).toMatch(/just received/)
        answerQuestion(s, 'ruler', discards(WOLVES))
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WAGON, INN])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', discards(ENCHANTRESS))).toMatch(/just received/)
        answerQuestion(s, 'other', discards(TENTS))
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([ENCHANTRESS, ELDERS, SCOUTS])
        expect(s.pendingQuestions?.queue).toEqual([])
    })

    it('Enchantress used from a site for a Nomad under Family Wagon: its holder, given a second non-Nomad, discards down', () => {
        const s = table([], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(WAGON), adviser(TENTS), adviser(SCOUTS)] }
        })
        s.denizensBySite = { ...s.denizensBySite, c1: [ENCHANTRESS] }
        actionPowerUse('ruler', ENCHANTRESS, [card(TENTS)]).apply(s)
        expect(s.denizensAt('c1')).toEqual([TENTS])
        expect(s.pendingQuestions?.queue).toMatchObject([{ askedPlayerId: 'other', count: 1, receivedCardIds: [ENCHANTRESS] }])
        expect(adviserLimitDiscards(s, 'other')).toEqual([WAGON, SCOUTS])
    })

    it("Twin Brother swapped for another player's Family Wagon: its player discards a non-Nomad, not the Wagon", () => {
        const s = table([INN, SCOUTS], OathRevision.EngineFixes7, { other: { advisers: [adviser(WAGON)] } })
        playDrawnCard(s, TWIN, SearchPlay.Adviser, [card(WAGON)])
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([TWIN])
        expect(s.pendingQuestions?.queue).toEqual([
            {
                kind: PowerQuestionKind.DiscardAdvisers,
                cardId: TWIN,
                askedPlayerId: 'ruler',
                actingPlayerId: 'ruler',
                count: 1,
                receivedCardIds: [WAGON]
            }
        ])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', discards(WAGON))).toMatch(/just received/)
        answerQuestion(s, 'ruler', discards(INN))
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([SCOUTS, WAGON])
    })

    it('Horned Mask swapping a Nomad adviser for a non-Nomad under Family Wagon: a discard that meets the limit is asked', () => {
        const s = table([], OathRevision.EngineFixes7, {
            ruler: { relicIds: [HORNED], advisers: [adviser(WAGON), adviser(WOLVES), adviser(TENTS), adviser(ELDERS)] }
        })
        s.denizensBySite = { ...s.denizensBySite, c1: [SCOUTS] }
        actionPowerUse('ruler', HORNED, [card(TENTS), card(SCOUTS)]).apply(s)
        expect(s.pendingQuestions?.queue).toMatchObject([{ askedPlayerId: 'ruler', count: 1, receivedCardIds: [SCOUTS] }])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', discards(SCOUTS))).toMatch(/just received/)
        // A Nomad ignores the limit under the Wagon, so discarding one leaves the player over it.
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', discards(ELDERS))).toMatch(/still over the adviser limit/)
        expect(adviserLimitDiscards(s, 'ruler')).toEqual([WAGON, WOLVES])
        // Discarding the Wagon itself lifts the limit to three.
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', discards(WAGON))).toBeUndefined()
        // A Nomad that goes before the card that meets the limit is no step toward it.
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', discards(ELDERS, WOLVES))).toMatch(
            new RegExp(`${ELDERS} does not bring you nearer the adviser limit`)
        )
        answerQuestion(s, 'ruler', discards(WOLVES))
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WAGON, SCOUTS, ELDERS])
    })

    it('Horned Mask under Family Wagon with a locked non-Nomad: the Wagon goes first, then a Nomad it no longer exempts', () => {
        const s = table([], OathRevision.EngineFixes7, {
            ruler: {
                relicIds: [HORNED],
                advisers: [adviser(WAGON), adviser(FALSE_PROPHET), adviser(ELDERS), adviser(STEED), adviser(TENTS)]
            }
        })
        s.denizensBySite = { ...s.denizensBySite, c1: [SCOUTS] }
        actionPowerUse('ruler', HORNED, [card(TENTS), card(SCOUTS)]).apply(s)
        // False Prophet and Scouts stand over the Wagon's limit of one; neither may go.
        expect(s.pendingQuestions?.queue).toMatchObject([{ askedPlayerId: 'ruler', count: 2, receivedCardIds: [SCOUTS] }])
        expect(adviserLimitDiscards(s, 'ruler')).toEqual([WAGON])
        expect(adviserLimitDiscards(s, 'ruler', [WAGON])).toEqual([ELDERS, STEED])
        expect(adviserLimitDiscardCount(s, 'ruler')).toBe(2)
        expect(adviserLimitDiscardCount(s, 'ruler', [WAGON])).toBe(2)
        const answers = [discards(WAGON, ELDERS), discards(ELDERS, WAGON), discards(WAGON), discards(ELDERS)]
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', answers[0])).toBeUndefined()
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', answers[1])).toMatch(
            new RegExp(`${ELDERS} does not bring you nearer the adviser limit`)
        )
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', answers[2])).toMatch(/still over the adviser limit/)
        const own = ownView(s, 'ruler')
        expect(adviserLimitDiscards(own, 'ruler')).toEqual([WAGON])
        expect(adviserLimitDiscards(own, 'ruler', [WAGON])).toEqual([ELDERS, STEED])
        for (const answer of answers) {
            expect(HydratedAnswerQuestion.reasonCannotAnswer(own, 'ruler', answer)).toEqual(
                HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', answer)
            )
        }
        answerQuestion(s, 'ruler', discards(WAGON, ELDERS))
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([FALSE_PROPHET, STEED, SCOUTS])
        expect(s.pendingQuestions?.queue).toEqual([])
    })

    it('Pied Piper received by a swap is not counted on its arrival', () => {
        const s = table([], OathRevision.EngineFixes7, {
            ruler: { relicIds: [HORNED], advisers: [adviser(WAGON), adviser(WOLVES), adviser(TENTS)] }
        })
        s.denizensBySite = { ...s.denizensBySite, c1: [PIPER] }
        actionPowerUse('ruler', HORNED, [card(TENTS), card(PIPER)]).apply(s)
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WAGON, WOLVES, PIPER])
        expect(s.pendingQuestions).toBeUndefined()
    })

    it('a swap that leaves every player within their limit asks nothing', () => {
        const s = table([ENCHANTRESS, INN, SCOUTS], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(TENTS), adviser(WOLVES), adviser(ELDERS)] }
        })
        actionPowerUse('ruler', ENCHANTRESS, [card(WOLVES)]).apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        const t = table([INN, SCOUTS], OathRevision.EngineFixes7)
        playDrawnCard(t, TWIN, SearchPlay.Adviser, [card(TENTS)])
        expect(t.pendingQuestions).toBeUndefined()
    })

    it("the discards offered and the answer read the same on the asked player's own view as on the server", () => {
        const s = table([ENCHANTRESS], OathRevision.EngineFixes7, {
            other: { advisers: [adviser(WOLVES, false), adviser(INN), adviser(FALSE_PROPHET), adviser(PIPER)] }
        })
        actionPowerUse('ruler', ENCHANTRESS, [card(PIPER)]).apply(s)
        const own = ownView(s, 'other')
        expect(adviserLimitDiscards(own, 'other')).toEqual(adviserLimitDiscards(s, 'other'))
        for (const answer of [discards(), discards(WOLVES), discards(INN), discards(ENCHANTRESS), discards(FALSE_PROPHET), discards(WOLVES, INN)]) {
            expect(HydratedAnswerQuestion.reasonCannotAnswer(own, 'other', answer)).toEqual(
                HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', answer)
            )
        }
        // Another player, who cannot see the facedown card, counts the same excess.
        const theirs = ownView(s, 'ruler')
        expect(advisersOverLimit(theirs, 'other', [ENCHANTRESS])).toBe(advisersOverLimit(s, 'other', [ENCHANTRESS]))
    })
})

describe('before revision 11 a swap asked no discard', () => {
    it('Enchantress swapped for Pied Piper left its holder with four advisers', () => {
        const s = table([ENCHANTRESS], OathRevision.EngineFixes6, {
            other: { advisers: [adviser(WOLVES), adviser(INN), adviser(SCOUTS), adviser(PIPER)] }
        })
        actionPowerUse('ruler', ENCHANTRESS, [card(PIPER)]).apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([WOLVES, INN, SCOUTS, ENCHANTRESS])
    })

    it('Twin Brother swapped for Family Wagon left its player over the limit', () => {
        const s = table([INN, SCOUTS], OathRevision.EngineFixes6, { other: { advisers: [adviser(WAGON)] } })
        playDrawnCard(s, TWIN, SearchPlay.Adviser, [card(WAGON)])
        expect(s.pendingQuestions).toBeUndefined()
    })
})

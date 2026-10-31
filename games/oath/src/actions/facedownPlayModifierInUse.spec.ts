import { describe, expect, it } from 'vitest'
import { Color, type GameAction, type Visibility } from '@tabletop/common'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { SearchPlay } from './searchResolve.js'
import { HydratedSearch, Search, SearchSource } from './search.js'
import { AnswerQuestion, HydratedAnswerQuestion } from './answerQuestion.js'
import { Banner, Region } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { MachineState } from '../definition/states.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testBanners, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { card, modifierUse, region, yes } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { FILLER, INN } from '../testing/cards.js'
import { adviserLimitDiscards } from '../util/adviserLimit.js'
import type { ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law 6.1 plays a facedown adviser "as if you searched (Restrictions and modifiers apply.)", and Law 7.4.3 says
// "A modifier cannot be discarded during the major action it is modifying." R-7.4.3-H1: from revision 31 a modifier
// declared for that play cannot be discarded during it, its When Played questions included, as in a Search.

const WILD_CRY = 'denizen.beast.wild-cry'
const BRACKEN = 'denizen.beast.bracken'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const WAGON = 'denizen.nomad.family-wagon'
const TWIN = 'denizen.nomad.twin-brother'
const ROAR = 'denizen.beast.threatening-roar'
const AUGURY = 'denizen.arcane.augury'
const FORCED_LABOR = 'denizen.order.forced-labor'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

const IN_USE = (cardId: string) =>
    `${cardId} is a modifier in use and cannot be discarded during the action it modifies`

interface Table {
    /** Dana's advisers, faceup. */
    faceup: string[]
    /** Dana's one facedown adviser. */
    facedown: string
    /** Dana's site c1, the Plains. */
    atSite?: string[]
    rhysAdvisers?: string[]
    favor?: boolean
    /** Rhys rules c1, and stands there, with Forced Labor there. */
    forcedLabor?: boolean
}

/** Dana on turn at c1 with one warband there, unless Rhys rules it with Forced Labor. */
function table(revision: OathRevision, t: Table): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 6,
                secrets: 2,
                supply: 3,
                advisers: [
                    ...t.faceup.map((cardId) => ({ cardId, faceUp: true })),
                    { cardId: t.facedown, faceUp: false }
                ]
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: t.forcedLabor ? 'c1' : 'c2',
                favor: 2,
                secrets: 2,
                advisers: (t.rhysAdvisers ?? []).map((cardId) => ({ cardId, faceUp: true }))
            })
        ]),
        {
            oathRevision: revision,
            denizensBySite: {
                c1: [...(t.forcedLabor ? [FORCED_LABOR] : []), ...(t.atSite ?? [])],
                c2: [],
                p1: [],
                h1: []
            },
            warbandsBySite: { c1: t.forcedLabor ? { rhys: 2 } : { dana: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            ...(t.favor ? { banners: testBanners({ [Banner.PeoplesFavor]: 'dana' }) } : {})
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [INN, FILLER, FILLER]
    return s
}

interface Play {
    cardId: string
    play: SearchPlay
    modifiers?: ModifierUse[]
    discardedAdviserCardIds?: string[]
    discardFirstCardId?: string
    choices?: ReturnType<typeof card>[]
    tolls?: string[]
}

const checkOf = (s: HydratedOathGameState, p: Play) =>
    HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', p)

const placeOf = (s: HydratedOathGameState, p: Play) =>
    HydratedPlayFacedownAdviser.reasonCannotPlace(s, 'dana', p)

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

function played(s: HydratedOathGameState, p: Play): HydratedPlayFacedownAdviser {
    const action = new HydratedPlayFacedownAdviser(
        buildAction(PlayFacedownAdviser, { playerId: 'dana', ...p })
    )
    action.apply(s)
    return action
}

function accepted(s: HydratedOathGameState, p: Play): boolean {
    try {
        played(s, p)
        return true
    } catch {
        return false
    }
}

const advisersOf = (s: HydratedOathGameState) => s.getPlayerState('dana').knownAdviserIds()

describe('Wild Cry declared on a facedown adviser played faceup, discarded to meet the limit (R-6.1, R-7.4.3)', () => {
    // Family Wagon turned faceup allows one adviser that is not a Nomad: Wild Cry or the Wolves must go.
    const WAGON_TABLE: Table = { faceup: [WILD_CRY, WOLVES], facedown: WAGON }
    const flip = (discarded: string, modifiers = [modifierUse(WILD_CRY)]): Play => ({
        cardId: WAGON,
        play: SearchPlay.Adviser,
        discardedAdviserCardIds: [discarded],
        modifiers
    })

    it('discarding Wild Cry is refused, and Dana keeps every adviser', () => {
        const s = table(FIXED, WAGON_TABLE)
        expect(checkOf(s, flip(WILD_CRY))).toBe(IN_USE(WILD_CRY))
        expect(placeOf(s, flip(WILD_CRY))).toBe(IN_USE(WILD_CRY))
        expect(accepted(s, flip(WILD_CRY))).toBe(false)
        expect(advisersOf(s)).toEqual([WILD_CRY, WOLVES, WAGON])
        expect(s.getPlayerState('dana').knownAdviser(WAGON)?.faceUp).toBe(false)
    })

    it('control: discarding the Wolves is accepted, and nothing stays in use after the play', () => {
        const s = table(FIXED, WAGON_TABLE)
        expect(checkOf(s, flip(WOLVES))).toBeUndefined()
        const action = played(s, flip(WOLVES))
        expect(advisersOf(s)).toEqual([WILD_CRY, WAGON])
        expect(action.metadata?.modifiers).toEqual([WILD_CRY])
        expect(s.searchModifiersInUse).toBeUndefined()
        expect(s.pendingQuestions).toBeUndefined()
    })

    it('a play that declares nothing may discard Wild Cry, as before', () => {
        const s = table(FIXED, WAGON_TABLE)
        expect(checkOf(s, flip(WILD_CRY, []))).toBeUndefined()
        expect(accepted(s, flip(WILD_CRY, []))).toBe(true)
        expect(advisersOf(s)).toEqual([WOLVES, WAGON])
    })

    it('before revision 31, discarding the declared Wild Cry is accepted', () => {
        const s = table(BEFORE, WAGON_TABLE)
        expect(checkOf(s, flip(WILD_CRY))).toBeUndefined()
        expect(accepted(s, flip(WILD_CRY))).toBe(true)
        expect(advisersOf(s)).toEqual([WOLVES, WAGON])
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it("on Dana's own view: the same answers, with neither the state copied nor changed", () => {
        const s = table(FIXED, WAGON_TABLE)
        const server = JSON.stringify(s.dehydrate())
        const own = ownView(s)
        expect(checkOf(own, flip(WILD_CRY))).toBe(IN_USE(WILD_CRY))
        expect(checkOf(own, flip(WOLVES))).toBeUndefined()
        expect(own.searchModifiersInUse).toBeUndefined()
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })
})

describe('a declared site modifier discarded first before a facedown adviser’s site play (R-6.1, R-7.4.3)', () => {
    // The People's Favor lets Dana discard a card at a site in their region first; Bracken sends it to a pile.
    const BRACKEN_TABLE: Table = {
        faceup: [],
        facedown: WOLVES,
        atSite: [BRACKEN, RANGERS],
        favor: true
    }
    const brackenUse = modifierUse(BRACKEN, [region(Region.Hinterland), yes])
    const toSite = (first: string, modifiers = [brackenUse]): Play => ({
        cardId: WOLVES,
        play: SearchPlay.Site,
        discardFirstCardId: first,
        modifiers
    })

    it('Bracken declared and discarded first is refused, and it stays at the site', () => {
        const s = table(FIXED, BRACKEN_TABLE)
        expect(checkOf(s, toSite(BRACKEN))).toBe(IN_USE(BRACKEN))
        expect(placeOf(s, toSite(BRACKEN))).toBe(IN_USE(BRACKEN))
        expect(checkOf(ownView(s), toSite(BRACKEN))).toBe(IN_USE(BRACKEN))
        expect(accepted(s, toSite(BRACKEN))).toBe(false)
        expect(s.denizensAt('c1')).toEqual([BRACKEN, RANGERS])
    })

    it('control: the Rangers discarded first are accepted, and go to the bottom of the pile Bracken names', () => {
        const s = table(FIXED, BRACKEN_TABLE)
        expect(checkOf(s, toSite(RANGERS))).toBeUndefined()
        expect(checkOf(ownView(s), toSite(RANGERS))).toBeUndefined()
        played(s, toSite(RANGERS))
        expect(s.denizensAt('c1')).toEqual([BRACKEN, WOLVES])
        expect(s.requireVault().discardPiles[Region.Hinterland]?.[0]).toBe(RANGERS)
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('Bracken not declared may be discarded first', () => {
        const s = table(FIXED, BRACKEN_TABLE)
        expect(checkOf(s, toSite(BRACKEN, []))).toBeUndefined()
    })

    it('before revision 31, Bracken declared and discarded first is accepted', () => {
        const s = table(BEFORE, BRACKEN_TABLE)
        expect(checkOf(s, toSite(BRACKEN))).toBeUndefined()
        expect(accepted(s, toSite(BRACKEN))).toBe(true)
        expect(s.denizensAt('c1')).toEqual([RANGERS, WOLVES])
    })

    it('Wild Cry at the site, declared for a beast played there, cannot be discarded first either', () => {
        const t: Table = { ...BRACKEN_TABLE, atSite: [WILD_CRY, RANGERS] }
        const wild = (first: string) => toSite(first, [modifierUse(WILD_CRY)])
        expect(checkOf(table(FIXED, t), wild(WILD_CRY))).toBe(IN_USE(WILD_CRY))
        expect(checkOf(table(FIXED, t), wild(RANGERS))).toBeUndefined()
        expect(checkOf(table(BEFORE, t), wild(WILD_CRY))).toBeUndefined()
    })
})

describe('the When Played mass discard of a facedown adviser played faceup (R-6.1, R-7.4.3, R-9.2)', () => {
    // Threatening Roar: "discard all nomad and beast cards at sites in your region". Wild Cry at Dana's site.
    const ROAR_TABLE: Table = { faceup: [], facedown: ROAR, atSite: [WILD_CRY, WOLVES] }
    const flip = (modifiers = [modifierUse(WILD_CRY)]): Play => ({
        cardId: ROAR,
        play: SearchPlay.Adviser,
        modifiers
    })
    const supplyGained = (s: HydratedOathGameState, p: Play) => {
        const before = s.getPlayerState('dana').supply
        const action = played(s, p)
        return { action, supply: s.getPlayerState('dana').supply - before }
    }

    it('Wild Cry in use stays, the Wolves go, and Wild Cry pays its Supply once', () => {
        const s = table(FIXED, ROAR_TABLE)
        const { action, supply } = supplyGained(s, flip())
        expect(s.denizensAt('c1')).toEqual([WILD_CRY])
        expect(supply).toBe(1)
        expect(action.metadata?.whenPlayed).toContain('discarded 1 nomad and beast cards')
        expect(action.metadata?.modifierNotes?.join(' ')).toContain('Wild Cry')
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('control: Wild Cry not declared is discarded with the Wolves', () => {
        const s = table(FIXED, ROAR_TABLE)
        played(s, flip([]))
        expect(s.denizensAt('c1')).toEqual([])
    })

    it('before revision 31, Wild Cry in use is discarded and still pays', () => {
        const s = table(BEFORE, ROAR_TABLE)
        const { supply } = supplyGained(s, flip())
        expect(s.denizensAt('c1')).toEqual([])
        expect(supply).toBe(1)
    })
})

function discards(...discardedAdviserCardIds: string[]): QuestionAnswer {
    return { kind: PowerQuestionKind.DiscardAdvisers, discardedAdviserCardIds }
}

describe("Twin Brother turned faceup and swapped for Rhys's Family Wagon, Wild Cry declared (R-6.1, R-7.4.3)", () => {
    const TWIN_TABLE: Table = {
        faceup: [WILD_CRY, WOLVES],
        facedown: TWIN,
        rhysAdvisers: [WAGON]
    }
    const flip: Play = {
        cardId: TWIN,
        play: SearchPlay.Adviser,
        choices: [card(WAGON)],
        modifiers: [modifierUse(WILD_CRY)]
    }
    const swapped = (revision: OathRevision) => {
        const s = table(revision, TWIN_TABLE)
        expect(accepted(s, flip)).toBe(true)
        expect(advisersOf(s)).toEqual(expect.arrayContaining([WILD_CRY, WOLVES, WAGON]))
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.DiscardAdvisers,
            askedPlayerId: 'dana'
        })
        return s
    }

    it('the limit question then refuses Wild Cry as the discard, and offers only the Wolves', () => {
        const s = swapped(FIXED)
        expect(s.searchModifiersInUse).toBeUndefined()
        expect(s.pendingQuestions?.searchModifiersInUse).toEqual([WILD_CRY])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', discards(WILD_CRY))).toBe(
            IN_USE(WILD_CRY)
        )
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', discards(WOLVES))).toBe(
            undefined
        )
        expect(adviserLimitDiscards(s, 'dana')).toEqual([WOLVES])
    })

    it("on Dana's own view: the same answers", () => {
        const s = swapped(FIXED)
        const server = JSON.stringify(s.dehydrate())
        const own = new HydratedOathGameState(served(s, dana))
        expect(own.pendingQuestions?.searchModifiersInUse).toEqual([WILD_CRY])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(own, 'dana', discards(WILD_CRY))).toBe(
            IN_USE(WILD_CRY)
        )
        expect(adviserLimitDiscards(own, 'dana')).toEqual([WOLVES])
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    it('through the engine: the question waits with Wild Cry in use, and the last answer ends the play', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED, TWIN_TABLE).dehydrate()
        const play = buildAction(PlayFacedownAdviser, { playerId: 'dana', ...flip })
        state = engine.runNext(play, state, game).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.pendingQuestions?.searchModifiersInUse).toEqual([WILD_CRY])
        const answer = (discarded: string): GameAction =>
            buildAction(AnswerQuestion, { playerId: 'dana', answer: discards(discarded) })
        expect(() => engine.runNext(answer(WILD_CRY), state, game)).toThrow()
        const after = engine.runNext(answer(WOLVES), state, game).updatedState
        expect(after.machineState).toBe(MachineState.ActPhase)
        expect(after.pendingQuestions).toBeUndefined()
        expect(after.searchModifiersInUse).toBeUndefined()
        expect(new HydratedOathGameState(after).getPlayerState('dana').knownAdviserIds()).toEqual([
            WILD_CRY,
            WAGON
        ])
    })

    it('before revision 31 the limit question accepts Wild Cry', () => {
        const s = swapped(BEFORE)
        expect(s.pendingQuestions?.searchModifiersInUse).toBeUndefined()
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', discards(WILD_CRY))).toBe(
            undefined
        )
        expect(adviserLimitDiscards(s, 'dana')).toEqual([WILD_CRY, WOLVES])
    })
})

describe('the in-use record ends with the facedown adviser’s play (R-6.1, R-7.4.3)', () => {
    const WILD_TABLE: Table = { faceup: [WILD_CRY, AUGURY], facedown: WOLVES }
    const toSite: Play = {
        cardId: WOLVES,
        play: SearchPlay.Site,
        modifiers: [modifierUse(WILD_CRY)]
    }
    const search = (modifiers: ModifierUse[]): GameAction =>
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers
        })

    it('through the engine: nothing is in use after the play, and a Search after it starts with its own record', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED, WILD_TABLE).dehydrate()
        const play = buildAction(PlayFacedownAdviser, { playerId: 'dana', ...toSite })
        state = engine.runNext(play, state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.searchModifiersInUse).toBeUndefined()
        expect(state.pendingQuestions).toBeUndefined()

        const plain = engine.runNext(search([]), state, game).updatedState
        expect(plain.searchModifiersInUse).toBeUndefined()
        const augury = engine.runNext(search([modifierUse(AUGURY)]), state, game).updatedState
        expect(augury.searchModifiersInUse).toEqual([AUGURY])
    })

    it('the same through the Search applied directly', () => {
        const s = table(FIXED, WILD_TABLE)
        played(s, toSite)
        expect(s.searchModifiersInUse).toBeUndefined()
        new HydratedSearch(
            buildAction(Search, {
                playerId: 'dana',
                drawFrom: SearchSource.WorldDeck,
                revealsInfo: true,
                modifiers: []
            })
        ).apply(s)
        expect(s.searchModifiersInUse).toBeUndefined()
    })
})

describe('Forced Labor tolls the facedown play while a declared modifier is in use (R-7.1.4, R-7.4.3)', () => {
    const LABOR_TABLE: Table = {
        faceup: [],
        facedown: WOLVES,
        atSite: [BRACKEN, RANGERS],
        favor: true,
        forcedLabor: true
    }
    const toSite = (first: string): Play => ({
        cardId: WOLVES,
        play: SearchPlay.Site,
        discardFirstCardId: first,
        modifiers: [modifierUse(BRACKEN, [region(Region.Hinterland), yes])],
        tolls: [FORCED_LABOR]
    })

    it('with the toll listed, Bracken discarded first is still refused as in use; the Rangers are accepted and the toll paid', () => {
        const s = table(FIXED, LABOR_TABLE)
        expect(HydratedPlayFacedownAdviser.tolls(s, 'dana')).toEqual([FORCED_LABOR])
        expect(checkOf(s, toSite(BRACKEN))).toBe(IN_USE(BRACKEN))
        const action = played(s, toSite(RANGERS))
        expect(action.metadata?.tollsPaid).toEqual([`${FORCED_LABOR}: gave a favor to rhys`])
        expect(s.denizensAt('c1')).toEqual([FORCED_LABOR, BRACKEN, WOLVES])
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('before revision 31, Bracken discarded first is accepted with the toll', () => {
        const s = table(BEFORE, LABOR_TABLE)
        expect(checkOf(s, toSite(BRACKEN))).toBeUndefined()
    })
})

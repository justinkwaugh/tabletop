import { describe, expect, it } from 'vitest'
import { Color, type GameAction, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { AnswerQuestion, HydratedAnswerQuestion } from './answerQuestion.js'
import { Banner, Region } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { MachineState } from '../definition/states.js'
import { OathVisibility } from '../definition/runtime.js'
import {
    openTurn,
    testBanners,
    testPlayer,
    testState,
    testVaultWithDiscards,
    withChancellor
} from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { card, modifierUse, region } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { FILLER, INN } from '../testing/cards.js'
import { adviserLimitDiscardCount, adviserLimitDiscards } from '../util/adviserLimit.js'
import { adviserDiscardable } from '../util/cardPlay.js'
import type { ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law 7.4.3: "A modifier cannot be discarded during the major action it is modifying." R-7.4.3-H1: the bar stops
// a discard imposed from outside the modifier's own resolution, such as the adviser-limit discard of an adviser
// play (R-5.1.4.II) and a card discarded before a site play (the People's Favor, the Great Slum, Crop Rotation).

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const LONGBOWS = 'denizen.order.longbows'
const AUGURY = 'denizen.arcane.augury'
const BRACKEN = 'denizen.beast.bracken'
const NEW_GROWTH = 'denizen.beast.new-growth'
const WILD_CRY = 'denizen.beast.wild-cry'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const NEWS = 'denizen.hearth.news-from-afar'
const HUNTING_PARTY = 'denizen.order.hunting-party'
const ERRAND_BOY = 'denizen.beast.errand-boy'
const WAGON = 'denizen.nomad.family-wagon'
const INSOMNIA = 'denizen.discord.insomnia'
const TWIN = 'denizen.nomad.twin-brother'
const WELCOMING = 'denizen.hearth.welcoming-party'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

interface Table {
    advisers: string[]
    top?: string[]
    modifiers: ModifierUse[]
    atSite?: string[]
    rhysAdvisers?: string[]
    site?: string
    favor?: boolean
    /** Search the Provinces discard pile, holding these cards, instead of the world deck. */
    provincesPile?: string[]
}

/** Dana at c1 (the Plains, unless `site` names another), holding `advisers` faceup (limit 3), before the Search. */
function table(revision: OathRevision, t: Table): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 6,
                secrets: 2,
                supply: 7,
                advisers: t.advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c2',
                favor: 2,
                secrets: 2,
                advisers: (t.rhysAdvisers ?? []).map((cardId) => ({ cardId, faceUp: true }))
            })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: t.atSite ?? [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: t.site ?? 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            ...(t.favor ? { banners: testBanners({ [Banner.PeoplesFavor]: 'dana' }) } : {})
        }
    )
    openTurn(s, 'dana')
    if (t.provincesPile) {
        s.vault = testVaultWithDiscards({ [Region.Provinces]: [...t.provincesPile] })
        s.discardPileCounts = { ...s.discardPileCounts, [Region.Provinces]: t.provincesPile.length }
    } else {
        s.requireVault().worldDeck = [...(t.top ?? [INN, LONGBOWS, FILLER])]
    }
    return s
}

function searchOf(t: Table): Search {
    return buildAction(Search, {
        playerId: 'dana',
        drawFrom: t.provincesPile ? SearchSource.Discard : SearchSource.WorldDeck,
        revealsInfo: true,
        modifiers: t.modifiers
    })
}

/** Dana has searched with `modifiers` declared. */
function searched(revision: OathRevision, t: Table): HydratedOathGameState {
    const s = table(revision, t)
    new HydratedSearch(searchOf(t)).apply(s)
    return s
}

function others(s: HydratedOathGameState, ...kept: string[]): string[] {
    return s
        .getPlayerState('dana')
        .knownHand()
        .filter((id) => !kept.includes(id))
}

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

/** Applies the resolve and says whether it was refused. */
function resolved(s: HydratedOathGameState, choice: SearchResolveChoice): boolean {
    try {
        new HydratedSearchResolve(
            buildAction(SearchResolve, { playerId: 'dana', ...choice })
        ).apply(s)
        return true
    } catch {
        return false
    }
}

const advisersOf = (s: HydratedOathGameState) => s.getPlayerState('dana').knownAdviserIds()

/** Longbows kept as an adviser, discarding `discarded` to make room; `second` played to Dana's site. */
function longbowsKept(
    s: HydratedOathGameState,
    discarded: string[],
    { faceUp = true, second }: { faceUp?: boolean; second?: string } = {}
): SearchResolveChoice {
    return {
        keptCardId: LONGBOWS,
        discardOrder: others(s, LONGBOWS, ...(second ? [second] : [])),
        play: SearchPlay.Adviser,
        faceUp,
        discardedAdviserCardIds: discarded,
        ...(second ? { secondPlay: { cardId: second, play: SearchPlay.Site } } : {})
    }
}

const IN_USE = (cardId: string) =>
    `${cardId} is a modifier in use and cannot be discarded during the action it modifies`

const WARDEN: Table = {
    advisers: [LAND_WARDEN, WOLVES, RANGERS],
    modifiers: [modifierUse(LAND_WARDEN)]
}

describe('the Search records every modifier it uses until it ends (from revision 31)', () => {
    it('every declared modifier is recorded, those without a play-time hook included', () => {
        const s = searched(FIXED, {
            advisers: [LAND_WARDEN, AUGURY, WOLVES],
            top: [INN, LONGBOWS, FILLER, RANGERS],
            modifiers: [modifierUse(LAND_WARDEN), modifierUse(AUGURY)]
        })
        expect(s.searchModifiersInUse).toEqual([LAND_WARDEN, AUGURY])
        // Augury changes only the draw, so the play carries Land Warden alone.
        expect(s.pendingSearchModifiers?.map((m) => m.cardId)).toEqual([LAND_WARDEN])
    })

    it('a Search with no modifier records none', () => {
        const s = searched(FIXED, { advisers: [WOLVES], modifiers: [] })
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('the resolve ends the Search when it asks no question: the record is gone', () => {
        const s = searched(FIXED, WARDEN)
        expect(resolved(s, longbowsKept(s, [WOLVES], { second: INN }))).toBe(true)
        expect(s.searchModifiersInUse).toBeUndefined()
        expect(s.pendingQuestions).toBeUndefined()
    })

    it('before revision 31 nothing is recorded', () => {
        const s = searched(BEFORE, {
            advisers: [LAND_WARDEN, AUGURY, WOLVES],
            top: [INN, LONGBOWS, FILLER, RANGERS],
            modifiers: [modifierUse(LAND_WARDEN), modifierUse(AUGURY)]
        })
        expect(s.searchModifiersInUse).toBeUndefined()
    })
})

describe('Land Warden discarded to the adviser limit during its own Search (R-7.4.3)', () => {
    it('Longbows kept faceup, the Inn second to the site, discarding Land Warden: refused, and Land Warden stays', () => {
        const s = searched(FIXED, WARDEN)
        const choice = longbowsKept(s, [LAND_WARDEN], { second: INN })
        expect(checkOf(s, choice)).toBe(IN_USE(LAND_WARDEN))
        expect(adviserDiscardable(s, 'dana', LAND_WARDEN)).toBe(false)
        expect(resolved(s, choice)).toBe(false)
        expect(advisersOf(s)).toEqual([LAND_WARDEN, WOLVES, RANGERS])
        expect(s.denizensAt('c1')).toEqual([])
    })

    it('control: the same play discarding the Wolves is accepted, and the Inn is played second', () => {
        const s = searched(FIXED, WARDEN)
        const choice = longbowsKept(s, [WOLVES], { second: INN })
        expect(checkOf(s, choice)).toBeUndefined()
        expect(resolved(s, choice)).toBe(true)
        expect(advisersOf(s)).toEqual([LAND_WARDEN, RANGERS, LONGBOWS])
        expect(s.denizensAt('c1')).toEqual([INN])
    })

    it('Longbows kept faceup with no second card, discarding Land Warden: refused', () => {
        const s = searched(FIXED, WARDEN)
        expect(checkOf(s, longbowsKept(s, [LAND_WARDEN]))).toBe(IN_USE(LAND_WARDEN))
        expect(checkOf(s, longbowsKept(s, [WOLVES]))).toBeUndefined()
    })

    it('Longbows kept facedown, discarding Land Warden: refused', () => {
        const s = searched(FIXED, WARDEN)
        expect(checkOf(s, longbowsKept(s, [LAND_WARDEN], { faceUp: false }))).toBe(
            IN_USE(LAND_WARDEN)
        )
        expect(checkOf(s, longbowsKept(s, [WOLVES], { faceUp: false }))).toBeUndefined()
    })

    it("on Dana's own view: the same answers, with neither the state copied nor changed", () => {
        const s = searched(FIXED, WARDEN)
        const server = JSON.stringify(s.dehydrate())
        const own = ownView(s)
        expect(own.searchModifiersInUse).toEqual([LAND_WARDEN])
        expect(checkOf(own, longbowsKept(own, [LAND_WARDEN], { second: INN }))).toBe(
            IN_USE(LAND_WARDEN)
        )
        expect(checkOf(own, longbowsKept(own, [LAND_WARDEN], { faceUp: false }))).toBe(
            IN_USE(LAND_WARDEN)
        )
        expect(checkOf(own, longbowsKept(own, [WOLVES], { second: INN }))).toBeUndefined()
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    it('a play whose only advisers to discard are in use is refused, as with locked cards', () => {
        const s = searched(FIXED, {
            advisers: [LAND_WARDEN, CROP_ROTATION, NEWS],
            modifiers: [modifierUse(LAND_WARDEN), modifierUse(CROP_ROTATION), modifierUse(NEWS)]
        })
        expect(s.searchModifiersInUse).toEqual([LAND_WARDEN, CROP_ROTATION, NEWS])
        for (const cardId of [LAND_WARDEN, CROP_ROTATION, NEWS])
            expect(checkOf(s, longbowsKept(s, [cardId]))).toBe(IN_USE(cardId))
        expect(checkOf(s, longbowsKept(s, []))).toBe(
            'already at the adviser limit of 3; one must be discarded first'
        )
        // A site play is still open.
        expect(
            checkOf(s, {
                keptCardId: LONGBOWS,
                discardOrder: others(s, LONGBOWS),
                play: SearchPlay.Site
            })
        ).toBeUndefined()
    })

    it('through the engine: the resolve discarding Land Warden is refused, and discarding the Wolves is accepted', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED, WARDEN).dehydrate()
        state = engine.runNext(searchOf(WARDEN), state, game).updatedState
        const after = new HydratedOathGameState(state)
        expect(after.searchModifiersInUse).toEqual([LAND_WARDEN])
        const resolve = (discarded: string): GameAction =>
            buildAction(SearchResolve, {
                playerId: 'dana',
                ...longbowsKept(after, [discarded], { second: INN })
            })
        expect(() => engine.runNext(resolve(LAND_WARDEN), state, game)).toThrow(IN_USE(LAND_WARDEN))
        const accepted = new HydratedOathGameState(
            engine.runNext(resolve(WOLVES), state, game).updatedState
        )
        expect(accepted.getPlayerState('dana').knownAdviserIds()).toEqual([
            LAND_WARDEN,
            RANGERS,
            LONGBOWS
        ])
        expect(accepted.searchModifiersInUse).toBeUndefined()
    })

    it('before revision 31 a game keeps the check it was recorded with: discarding Land Warden is accepted', () => {
        for (const options of [{ second: INN }, {}, { faceUp: false }]) {
            const s = searched(BEFORE, WARDEN)
            const choice = longbowsKept(s, [LAND_WARDEN], options)
            expect(checkOf(s, choice)).toBeUndefined()
            expect(resolved(s, choice)).toBe(true)
            expect(advisersOf(s)).not.toContain(LAND_WARDEN)
        }
    })
})

// Every other Search modifier a player can hold as an adviser and declare on their own Search.
const SEARCH_MODIFIERS: [string, string, Table][] = [
    [
        'Augury',
        AUGURY,
        {
            advisers: [AUGURY, WOLVES, RANGERS],
            top: [INN, LONGBOWS, FILLER, WOLVES],
            modifiers: [modifierUse(AUGURY)]
        }
    ],
    [
        'Bracken',
        BRACKEN,
        {
            advisers: [BRACKEN, WOLVES, RANGERS],
            modifiers: [modifierUse(BRACKEN, [region(Region.Provinces)])]
        }
    ],
    [
        'Errand Boy',
        ERRAND_BOY,
        {
            advisers: [ERRAND_BOY, WOLVES, RANGERS],
            provincesPile: [LONGBOWS, INN, FILLER],
            modifiers: [modifierUse(ERRAND_BOY, [region(Region.Provinces)])]
        }
    ],
    [
        'New Growth',
        NEW_GROWTH,
        { advisers: [NEW_GROWTH, WOLVES, RANGERS], modifiers: [modifierUse(NEW_GROWTH)] }
    ],
    [
        'Wild Cry',
        WILD_CRY,
        { advisers: [WILD_CRY, WOLVES, RANGERS], modifiers: [modifierUse(WILD_CRY)] }
    ],
    [
        'Crop Rotation',
        CROP_ROTATION,
        { advisers: [CROP_ROTATION, WOLVES, RANGERS], modifiers: [modifierUse(CROP_ROTATION)] }
    ],
    ['News from Afar', NEWS, { advisers: [NEWS, WOLVES, RANGERS], modifiers: [modifierUse(NEWS)] }],
    [
        'Hunting Party',
        HUNTING_PARTY,
        { advisers: [HUNTING_PARTY, WOLVES, RANGERS], modifiers: [modifierUse(HUNTING_PARTY)] }
    ]
]

describe('each Search modifier held as an adviser, discarded to the limit during its own Search', () => {
    for (const [name, cardId, t] of SEARCH_MODIFIERS) {
        it(`${name}: Longbows kept as an adviser discarding ${name} is refused, and ${name} stays; the Wolves are accepted`, () => {
            const s = searched(FIXED, t)
            expect(s.getPlayerState('dana').knownHand()).toContain(LONGBOWS)
            expect(s.searchModifiersInUse).toEqual([cardId])
            expect(checkOf(s, longbowsKept(s, [cardId]))).toBe(IN_USE(cardId))
            expect(checkOf(ownView(s), longbowsKept(s, [cardId]))).toBe(IN_USE(cardId))
            expect(resolved(s, longbowsKept(s, [cardId]))).toBe(false)
            expect(advisersOf(s)).toContain(cardId)
            expect(checkOf(s, longbowsKept(s, [WOLVES]))).toBeUndefined()
        })

        it(`${name}: before revision 31, discarding it is accepted`, () => {
            const s = searched(BEFORE, t)
            expect(checkOf(s, longbowsKept(s, [cardId]))).toBeUndefined()
            expect(resolved(s, longbowsKept(s, [cardId]))).toBe(true)
            expect(advisersOf(s)).not.toContain(cardId)
        })
    }

    const WILD_CRY_BEAST: Table = {
        advisers: [WILD_CRY, WOLVES, LONGBOWS],
        top: [RANGERS, INN, FILLER],
        modifiers: [modifierUse(WILD_CRY)]
    }
    const rangersKept = (s: HydratedOathGameState, discarded: string): SearchResolveChoice => ({
        keptCardId: RANGERS,
        discardOrder: others(s, RANGERS),
        play: SearchPlay.Adviser,
        faceUp: true,
        discardedAdviserCardIds: [discarded]
    })
    const supplyGained = (revision: OathRevision, discarded: string) => {
        const s = searched(revision, WILD_CRY_BEAST)
        const before = s.getPlayerState('dana').supply
        const accepted = resolved(s, rangersKept(s, discarded))
        return {
            accepted,
            wildCryHeld: advisersOf(s).includes(WILD_CRY),
            gained: s.getPlayerState('dana').supply - before
        }
    }

    it('Wild Cry discarded to the limit as a beast card is kept: refused, and Wild Cry pays nothing', () => {
        expect(supplyGained(FIXED, WILD_CRY)).toEqual({
            accepted: false,
            wildCryHeld: true,
            gained: 0
        })
    })

    it('control: the Wolves discarded instead, Wild Cry pays its Supply as it did before revision 31', () => {
        const control = supplyGained(FIXED, WOLVES)
        expect(control).toMatchObject({ accepted: true, wildCryHeld: true })
        expect(control.gained).toBeGreaterThan(0)
        expect(supplyGained(BEFORE, WILD_CRY)).toEqual({
            accepted: true,
            wildCryHeld: false,
            gained: control.gained
        })
    })
})

describe('an adviser limiter kept during a Search with Land Warden in use', () => {
    const wagon = (revision: OathRevision) =>
        searched(revision, {
            advisers: [LAND_WARDEN, WOLVES],
            top: [WAGON, INN, FILLER],
            modifiers: [modifierUse(LAND_WARDEN)]
        })
    const wagonKept = (s: HydratedOathGameState, discarded: string): SearchResolveChoice => ({
        keptCardId: WAGON,
        discardOrder: others(s, WAGON, INN),
        play: SearchPlay.Adviser,
        faceUp: true,
        discardedAdviserCardIds: [discarded],
        secondPlay: { cardId: INN, play: SearchPlay.Site }
    })

    it('Family Wagon kept faceup with Land Warden and the Wolves: discarding Land Warden is refused', () => {
        const s = wagon(FIXED)
        expect(checkOf(s, wagonKept(s, LAND_WARDEN))).toBe(IN_USE(LAND_WARDEN))
        expect(checkOf(ownView(s), wagonKept(s, LAND_WARDEN))).toBe(IN_USE(LAND_WARDEN))
    })

    it('control: Family Wagon kept discarding the Wolves is accepted', () => {
        const s = wagon(FIXED)
        expect(checkOf(s, wagonKept(s, WOLVES))).toBeUndefined()
        expect(resolved(s, wagonKept(s, WOLVES))).toBe(true)
        expect(advisersOf(s)).toEqual([LAND_WARDEN, WAGON])
    })

    it('before revision 31, Family Wagon kept discarding Land Warden is accepted', () => {
        const s = wagon(BEFORE)
        expect(checkOf(s, wagonKept(s, LAND_WARDEN))).toBeUndefined()
    })

    const insomnia = (revision: OathRevision) => {
        const s = searched(revision, WARDEN)
        s.getPlayerState('dana').handIds = [INSOMNIA, INN, FILLER]
        return s
    }
    const insomniaKept = (s: HydratedOathGameState, discarded: string[]): SearchResolveChoice => ({
        keptCardId: INSOMNIA,
        discardOrder: others(s, INSOMNIA, INN),
        play: SearchPlay.Adviser,
        faceUp: true,
        discardedAdviserCardIds: discarded,
        secondPlay: { cardId: INN, play: SearchPlay.Site }
    })

    it('Insomnia kept faceup with three advisers: discarding Land Warden among the two is refused', () => {
        const s = insomnia(FIXED)
        expect(checkOf(s, insomniaKept(s, [LAND_WARDEN, WOLVES]))).toBe(IN_USE(LAND_WARDEN))
        expect(checkOf(s, insomniaKept(s, [WOLVES, RANGERS]))).toBeUndefined()
        expect(checkOf(insomnia(BEFORE), insomniaKept(s, [LAND_WARDEN, WOLVES]))).toBeUndefined()
    })
})

function discards(...discardedAdviserCardIds: string[]): QuestionAnswer {
    return { kind: PowerQuestionKind.DiscardAdvisers, discardedAdviserCardIds }
}

describe("Twin Brother swapped for Rhys's Family Wagon during a Search with Land Warden in use", () => {
    const TWIN_TABLE: Table = {
        advisers: [LAND_WARDEN, WOLVES],
        top: [TWIN, INN, FILLER],
        modifiers: [modifierUse(LAND_WARDEN)],
        rhysAdvisers: [WAGON]
    }
    const twinKept = (s: HydratedOathGameState): SearchResolveChoice => ({
        keptCardId: TWIN,
        discardOrder: others(s, TWIN, INN),
        play: SearchPlay.Adviser,
        faceUp: true,
        choices: [card(WAGON)],
        secondPlay: { cardId: INN, play: SearchPlay.Site }
    })
    const swapped = (revision: OathRevision) => {
        const s = searched(revision, TWIN_TABLE)
        expect(resolved(s, twinKept(s))).toBe(true)
        expect(advisersOf(s)).toEqual(expect.arrayContaining([LAND_WARDEN, WOLVES, WAGON]))
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.DiscardAdvisers,
            askedPlayerId: 'dana'
        })
        return s
    }

    it('the limit question then refuses Land Warden as the discard, and offers only the Wolves', () => {
        const s = swapped(FIXED)
        expect(s.searchModifiersInUse).toBeUndefined()
        expect(s.pendingQuestions?.searchModifiersInUse).toEqual([LAND_WARDEN])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', discards(LAND_WARDEN))).toBe(
            IN_USE(LAND_WARDEN)
        )
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', discards(WOLVES))).toBe(
            undefined
        )
        expect(adviserLimitDiscards(s, 'dana')).toEqual([WOLVES])
        expect(adviserLimitDiscardCount(s, 'dana')).toBe(1)
    })

    it("on Dana's own view: the same answers", () => {
        const s = swapped(FIXED)
        const server = JSON.stringify(s.dehydrate())
        // The asked player's own view carries the question's fields (`util/adviserLimit.spec.ts`).
        const own = new HydratedOathGameState(served(s, dana))
        expect(own.pendingQuestions?.searchModifiersInUse).toEqual([LAND_WARDEN])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(own, 'dana', discards(LAND_WARDEN))).toBe(
            IN_USE(LAND_WARDEN)
        )
        expect(adviserLimitDiscards(own, 'dana')).toEqual([WOLVES])
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    it('through the engine: the question waits with Land Warden in use, and the last answer ends the Search', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED, TWIN_TABLE).dehydrate()
        state = engine.runNext(searchOf(TWIN_TABLE), state, game).updatedState
        const resolve = buildAction(SearchResolve, {
            playerId: 'dana',
            ...twinKept(new HydratedOathGameState(state))
        })
        state = engine.runNext(resolve, state, game).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.pendingQuestions?.searchModifiersInUse).toEqual([LAND_WARDEN])
        const answer = (discarded: string): GameAction =>
            buildAction(AnswerQuestion, { playerId: 'dana', answer: discards(discarded) })
        expect(() => engine.runNext(answer(LAND_WARDEN), state, game)).toThrow()
        const after = engine.runNext(answer(WOLVES), state, game).updatedState
        expect(after.machineState).toBe(MachineState.ActPhase)
        expect(after.pendingQuestions).toBeUndefined()
        expect(after.searchModifiersInUse).toBeUndefined()
        // Twin Brother went to Rhys in the swap.
        expect(new HydratedOathGameState(after).getPlayerState('dana').knownAdviserIds()).toEqual([
            LAND_WARDEN,
            WAGON
        ])
    })

    it('before revision 31 the limit question accepts Land Warden', () => {
        const s = swapped(BEFORE)
        expect(s.pendingQuestions?.searchModifiersInUse).toBeUndefined()
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', discards(LAND_WARDEN))).toBe(
            undefined
        )
        expect(adviserLimitDiscards(s, 'dana')).toEqual([LAND_WARDEN, WOLVES])
    })
})

// Welcoming Party at Dana's site, in use on the Search; the Inn kept and played there, discarding a card first.
const innFirst = (s: HydratedOathGameState, first: string): SearchResolveChoice => ({
    keptCardId: INN,
    discardOrder: others(s, INN),
    play: SearchPlay.Site,
    discardFirstCardId: first
})

const DISCARD_FIRST: [string, Table][] = [
    [
        'Crop Rotation',
        {
            advisers: [CROP_ROTATION],
            atSite: [WELCOMING, WOLVES, RANGERS],
            modifiers: [modifierUse(CROP_ROTATION), modifierUse(WELCOMING)]
        }
    ],
    [
        "the People's Favor",
        {
            advisers: [],
            atSite: [WELCOMING, WOLVES, RANGERS],
            favor: true,
            modifiers: [modifierUse(WELCOMING)]
        }
    ],
    [
        'the Great Slum',
        {
            advisers: [],
            atSite: [WELCOMING, WOLVES, RANGERS],
            site: 'site.great-slums',
            modifiers: [modifierUse(WELCOMING)]
        }
    ]
]

describe('a site Search modifier in use, discarded first before a site play (R-7.4.3)', () => {
    for (const [name, t] of DISCARD_FIRST) {
        const favorGained = (revision: OathRevision, first: string) => {
            const s = searched(revision, t)
            const before = s.getPlayerState('dana').favor
            const accepted = resolved(s, innFirst(s, first))
            return {
                accepted,
                atSite: s.denizensAt('c1'),
                gained: s.getPlayerState('dana').favor - before
            }
        }

        it(`${name}: Welcoming Party discarded first is refused, and it stays at the site`, () => {
            const s = searched(FIXED, t)
            expect(s.searchModifiersInUse).toContain(WELCOMING)
            expect(checkOf(s, innFirst(s, WELCOMING))).toBe(IN_USE(WELCOMING))
            expect(checkOf(ownView(s), innFirst(s, WELCOMING))).toBe(IN_USE(WELCOMING))
            expect(favorGained(FIXED, WELCOMING)).toEqual({
                accepted: false,
                atSite: [WELCOMING, WOLVES, RANGERS],
                gained: 0
            })
        })

        it(`${name}: control, the Wolves discarded first are accepted, and Welcoming Party pays its favor`, () => {
            const s = searched(FIXED, t)
            expect(checkOf(s, innFirst(s, WOLVES))).toBeUndefined()
            expect(checkOf(ownView(s), innFirst(s, WOLVES))).toBeUndefined()
            const control = favorGained(FIXED, WOLVES)
            expect(control).toMatchObject({ accepted: true, atSite: [WELCOMING, RANGERS, INN] })
            expect(control.gained).toBeGreaterThan(0)
        })

        it(`${name}: before revision 31, Welcoming Party discarded first is accepted`, () => {
            const s = searched(BEFORE, t)
            expect(checkOf(s, innFirst(s, WELCOMING))).toBeUndefined()
            expect(favorGained(BEFORE, WELCOMING)).toMatchObject({
                accepted: true,
                atSite: [WOLVES, RANGERS, INN]
            })
        })
    }
})

import { describe, expect, it } from 'vitest'
import { Color, type GameAction, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { AdviserRow } from '../model/playerState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { advisersOverLimit } from '../util/continuous.js'
import { adviserDiscardsNeeded, adviserPlayDiscardSets } from '../util/cardPlay.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law 5.1.4.II: "If you are playing an adviser that would exceed your adviser limit, you must first discard an
// adviser." Family Wagon: "You can only have one adviser that is not a nomad. You can have any number of nomad
// advisers — they ignore your adviser limit." Law 7.6.4: with several limits, the lowest applies. The discard must
// leave the player within their limit once the card is played, as a swap's or an exchange's discard must.

const WAGON = 'denizen.nomad.family-wagon'
const ELDERS = 'denizen.nomad.elders'
const STEED = 'denizen.nomad.a-fast-steed'
const SCOUTS = 'denizen.order.scouts'
const KEEP = 'denizen.order.keep'
const LONGBOWS = 'denizen.order.longbows'
const WOLVES = 'denizen.beast.wolves'
const PIPER = 'denizen.beast.pied-piper'
const INSOMNIA = 'denizen.discord.insomnia'
const LAND_WARDEN = 'denizen.hearth.land-warden'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

const up = (cardId: string): AdviserRow => ({ cardId, faceUp: true })
const down = (cardId: string): AdviserRow => ({ cardId, faceUp: false })

/** Dana at the Plains (c1, empty) holding `advisers`, their limit 3, with the world deck's top three set. */
function table(
    revision: OathRevision,
    advisers: AdviserRow[],
    top: string[] = [WOLVES, FILLER, INN]
): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                supply: 6,
                advisers
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [...top]
    return s
}

function searchOf(modifiers: ReturnType<typeof modifierUse>[] = []): Search {
    return buildAction(Search, {
        playerId: 'dana',
        drawFrom: SearchSource.WorldDeck,
        revealsInfo: true,
        modifiers
    })
}

/** Dana has searched, drawing `top`. */
function searched(
    revision: OathRevision,
    advisers: AdviserRow[],
    top?: string[],
    modifiers?: ReturnType<typeof modifierUse>[]
): HydratedOathGameState {
    const s = table(revision, advisers, top)
    new HydratedSearch(searchOf(modifiers)).apply(s)
    return s
}

function others(s: HydratedOathGameState, ...kept: string[]): string[] {
    return s
        .getPlayerState('dana')
        .knownHand()
        .filter((id) => !kept.includes(id))
}

/** `kept` played as an adviser, discarding `discarded` first. */
function keptAs(
    s: HydratedOathGameState,
    kept: string,
    discarded: string[],
    faceUp = true
): SearchResolveChoice {
    return {
        keptCardId: kept,
        discardOrder: others(s, kept),
        play: SearchPlay.Adviser,
        faceUp,
        ...(discarded.length > 0 ? { discardedAdviserCardIds: discarded } : {})
    }
}

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice): void {
    new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'dana', ...choice })).apply(s)
}

const advisersOf = (s: HydratedOathGameState) => s.getPlayerState('dana').knownAdviserIds()

const OVER = (by: number) => `still over the adviser limit by ${by} after the play`

const FACEUP = { faceUp: true }

describe('an adviser play under Family Wagon discards to within the limit (from revision 31)', () => {
    it('Scouts held, the Wolves kept faceup: discarding Tents, a Nomad, is refused, on Dana’s own view too', () => {
        const s = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS)])
        expect(adviserDiscardsNeeded(s, 'dana', WOLVES, FACEUP)).toBe(1)
        expect(checkOf(s, keptAs(s, WOLVES, [TENTS]))).toBe(OVER(1))
        expect(checkOf(ownView(s), keptAs(s, WOLVES, [TENTS]))).toBe(OVER(1))
        expect(() => resolve(s, keptAs(s, WOLVES, [TENTS]))).toThrow(OVER(1))
        expect(advisersOf(s)).toEqual([WAGON, SCOUTS, TENTS])
    })

    it('discarding Scouts, the other non-Nomad, is accepted and leaves Dana within the limit', () => {
        const s = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS)])
        expect(checkOf(s, keptAs(s, WOLVES, [SCOUTS]))).toBeUndefined()
        resolve(s, keptAs(s, WOLVES, [SCOUTS]))
        expect(advisersOf(s)).toEqual([WAGON, TENTS, WOLVES])
        expect(advisersOverLimit(s, 'dana')).toBe(0)
    })

    it('discarding the Wagon is accepted: without it the limit is three, and three are held', () => {
        const s = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS)])
        resolve(s, keptAs(s, WOLVES, [WAGON]))
        expect(advisersOf(s)).toEqual([SCOUTS, TENTS, WOLVES])
        expect(advisersOverLimit(s, 'dana')).toBe(0)
    })

    it('over three Nomads, discarding the Wagon makes them count, so it is refused; Scouts is accepted', () => {
        const s = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS), up(ELDERS), up(STEED)])
        expect(adviserDiscardsNeeded(s, 'dana', WOLVES, FACEUP)).toBe(1)
        expect(checkOf(s, keptAs(s, WOLVES, [WAGON]))).toBe(OVER(2))
        expect(checkOf(s, keptAs(s, WOLVES, [SCOUTS]))).toBeUndefined()
    })

    it('a facedown adviser counts as a non-Nomad: discarding it meets the limit, and Tents does not', () => {
        const s = searched(FIXED, [up(WAGON), up(TENTS), down(ELDERS)])
        expect(adviserDiscardsNeeded(s, 'dana', WOLVES, FACEUP)).toBe(1)
        for (const view of [s, ownView(s)]) {
            expect(checkOf(view, keptAs(s, WOLVES, [TENTS]))).toBe(OVER(1))
            expect(checkOf(view, keptAs(s, WOLVES, [ELDERS]))).toBeUndefined()
            expect(checkOf(view, keptAs(s, WOLVES, [WAGON]))).toBeUndefined()
        }
        resolve(s, keptAs(s, WOLVES, [ELDERS]))
        expect(advisersOf(s)).toEqual([WAGON, TENTS, WOLVES])
    })

    it('the Wolves kept facedown count as a non-Nomad too: discarding Tents is refused', () => {
        const s = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS)])
        expect(adviserDiscardsNeeded(s, 'dana', WOLVES, { faceUp: false })).toBe(1)
        expect(checkOf(s, keptAs(s, WOLVES, [TENTS], false))).toBe(OVER(1))
        expect(checkOf(s, keptAs(s, WOLVES, [SCOUTS], false))).toBeUndefined()
    })

    it('with Insomnia, the lowest limit binds: discarding the Wagon leaves three advisers over Insomnia’s two', () => {
        const s = searched(FIXED, [up(WAGON), up(INSOMNIA), up(TENTS)], [SCOUTS, FILLER, INN])
        expect(adviserDiscardsNeeded(s, 'dana', SCOUTS, FACEUP)).toBe(1)
        expect(checkOf(s, keptAs(s, SCOUTS, [TENTS]))).toBe(OVER(1))
        expect(checkOf(s, keptAs(s, SCOUTS, [WAGON]))).toBe(OVER(1))
        expect(checkOf(s, keptAs(s, SCOUTS, [INSOMNIA]))).toBe(
            `${INSOMNIA} is locked and cannot be discarded`
        )
        expect(adviserPlayDiscardSets(s, 'dana', SCOUTS, FACEUP)).toEqual([])
        const withoutInsomnia = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS)])
        expect(checkOf(withoutInsomnia, keptAs(withoutInsomnia, WOLVES, [WAGON]))).toBeUndefined()
    })

    it('a play no discard brings within the limit is refused, as over locked cards', () => {
        const s = searched(FIXED, [up(WAGON), up(KEEP), up(TENTS), up(ELDERS)])
        expect(adviserDiscardsNeeded(s, 'dana', WOLVES, FACEUP)).toBe(1)
        expect(checkOf(s, keptAs(s, WOLVES, [KEEP]))).toBe(
            `${KEEP} is locked and cannot be discarded`
        )
        expect(checkOf(s, keptAs(s, WOLVES, [WAGON]))).toBe(OVER(1))
        for (const nomad of [TENTS, ELDERS]) {
            expect(checkOf(s, keptAs(s, WOLVES, [nomad]))).toBe(OVER(1))
            expect(checkOf(s, keptAs(s, WOLVES, [nomad], false))).toBe(OVER(1))
        }
        expect(adviserPlayDiscardSets(s, 'dana', WOLVES, FACEUP)).toEqual([])
        expect(adviserPlayDiscardSets(s, 'dana', WOLVES, { faceUp: false })).toEqual([])
    })
})

describe('Silver Tongue and Assassin, two-adviser limiters, kept faceup', () => {
    for (const { name, limiter } of [
        { name: 'Silver Tongue', limiter: 'denizen.discord.silver-tongue' },
        { name: 'Assassin', limiter: 'denizen.discord.assassin' }
    ]) {
        it(`${name} under the Wagon: only Scouts goes; Tents leaves two non-Nomads, the Wagon three advisers`, () => {
            const s = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS)], [limiter, FILLER, INN])
            expect(adviserDiscardsNeeded(s, 'dana', limiter, FACEUP)).toBe(1)
            expect(checkOf(s, keptAs(s, limiter, [TENTS]))).toBe(OVER(1))
            expect(checkOf(s, keptAs(s, limiter, [WAGON]))).toBe(OVER(1))
            expect(adviserPlayDiscardSets(s, 'dana', limiter, FACEUP)).toEqual([[SCOUTS]])
            resolve(s, keptAs(s, limiter, [SCOUTS]))
            expect(advisersOf(s)).toEqual([WAGON, TENTS, limiter])
            expect(advisersOverLimit(s, 'dana')).toBe(0)
        })

        it(`${name} over three advisers without the Wagon: any two go`, () => {
            const s = searched(FIXED, [up(SCOUTS), up(TENTS), up(ELDERS)], [limiter, FILLER, INN])
            expect(adviserPlayDiscardSets(s, 'dana', limiter, FACEUP)).toEqual([
                [SCOUTS, TENTS],
                [SCOUTS, ELDERS],
                [TENTS, ELDERS]
            ])
        })
    }
})

describe('Pied Piper under Family Wagon (both its Q&As)', () => {
    it('played faceup it prompts no discard, and is accepted over a non-Nomad', () => {
        const s = searched(FIXED, [up(WAGON), up(SCOUTS)], [PIPER, FILLER, INN])
        expect(adviserDiscardsNeeded(s, 'dana', PIPER, FACEUP)).toBe(0)
        expect(checkOf(s, keptAs(s, PIPER, []))).toBeUndefined()
        resolve(s, keptAs(s, PIPER, []))
        expect(advisersOf(s)).toEqual([WAGON, SCOUTS, PIPER])
    })

    it('held, it counts: the Wolves kept over it discard the Piper or the Wagon, never Tents', () => {
        const s = searched(FIXED, [up(WAGON), up(TENTS), up(PIPER)])
        expect(adviserDiscardsNeeded(s, 'dana', WOLVES, FACEUP)).toBe(1)
        expect(checkOf(s, keptAs(s, WOLVES, [TENTS]))).toBe(OVER(1))
        expect(checkOf(s, keptAs(s, WOLVES, [PIPER]))).toBeUndefined()
        expect(checkOf(s, keptAs(s, WOLVES, [WAGON]))).toBeUndefined()
        expect(adviserPlayDiscardSets(s, 'dana', WOLVES, FACEUP)).toEqual([[WAGON], [PIPER]])
    })
})

describe('a facedown adviser played faceup under Family Wagon (R-6.1)', () => {
    const flip = (discarded: string) => ({
        cardId: WOLVES,
        play: SearchPlay.Adviser,
        discardedAdviserCardIds: [discarded]
    })

    it('discarding Tents is refused; discarding Scouts is accepted and leaves Dana within the limit', () => {
        const s = table(FIXED, [up(WAGON), up(SCOUTS), up(TENTS), down(WOLVES)])
        for (const view of [s, ownView(s)]) {
            expect(HydratedPlayFacedownAdviser.reasonCannotPlay(view, 'dana', flip(TENTS))).toBe(
                OVER(1)
            )
            expect(
                HydratedPlayFacedownAdviser.reasonCannotPlay(view, 'dana', flip(SCOUTS))
            ).toBeUndefined()
        }
        expect(
            adviserPlayDiscardSets(s, 'dana', WOLVES, { faceUp: true, fromAdvisers: true })
        ).toEqual([[WAGON], [SCOUTS]])
        new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, { playerId: 'dana', ...flip(SCOUTS) })
        ).apply(s)
        expect(s.getPlayerState('dana').faceupAdviserIds()).toEqual([WAGON, TENTS, WOLVES])
        expect(advisersOverLimit(s, 'dana')).toBe(0)
    })
})

describe('Family Wagon with Land Warden in use (R-7.4.3) and its second card', () => {
    const WARDEN = [up(LAND_WARDEN), up(WAGON), up(TENTS)]
    const wardenSearch = (revision: OathRevision) =>
        searched(revision, WARDEN, [INN, LONGBOWS, FILLER], [modifierUse(LAND_WARDEN)])
    const IN_USE = `${LAND_WARDEN} is a modifier in use and cannot be discarded during the action it modifies`

    const innThenLongbows = (discarded: string, faceUp = true): SearchResolveChoice => ({
        keptCardId: INN,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        secondPlay: {
            cardId: LONGBOWS,
            play: SearchPlay.Adviser,
            faceUp,
            discardedAdviserCardIds: [discarded]
        }
    })
    const longbowsThenInn = (discarded: string): SearchResolveChoice => ({
        keptCardId: LONGBOWS,
        discardOrder: [FILLER],
        play: SearchPlay.Adviser,
        faceUp: true,
        discardedAdviserCardIds: [discarded],
        secondPlay: { cardId: INN, play: SearchPlay.Site }
    })

    it('Longbows second: Tents is refused for the limit, Land Warden for its use, and the Wagon is accepted', () => {
        const s = wardenSearch(FIXED)
        for (const faceUp of [true, false]) {
            expect(checkOf(s, innThenLongbows(TENTS, faceUp))).toBe(`second card: ${OVER(1)}`)
            expect(checkOf(s, innThenLongbows(LAND_WARDEN, faceUp))).toBe(`second card: ${IN_USE}`)
            expect(checkOf(s, innThenLongbows(WAGON, faceUp))).toBeUndefined()
            expect(checkOf(ownView(s), innThenLongbows(TENTS, faceUp))).toBe(
                `second card: ${OVER(1)}`
            )
        }
        expect(adviserPlayDiscardSets(s, 'dana', LONGBOWS, FACEUP)).toEqual([[WAGON]])
        resolve(s, innThenLongbows(WAGON))
        expect(advisersOf(s)).toEqual([LAND_WARDEN, TENTS, LONGBOWS])
        expect(s.denizensAt('c1')).toEqual([INN])
    })

    it('Longbows kept, the Inn second: the same discards are refused and accepted', () => {
        const s = wardenSearch(FIXED)
        expect(checkOf(s, longbowsThenInn(TENTS))).toBe(OVER(1))
        expect(checkOf(s, longbowsThenInn(LAND_WARDEN))).toBe(IN_USE)
        expect(checkOf(s, longbowsThenInn(WAGON))).toBeUndefined()
    })

    it('through the engine: discarding Tents is refused, and discarding the Wagon is accepted', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED, WARDEN, [INN, LONGBOWS, FILLER]).dehydrate()
        state = engine.runNext(searchOf([modifierUse(LAND_WARDEN)]), state, game).updatedState
        const resolveOf = (discarded: string): GameAction =>
            buildAction(SearchResolve, { playerId: 'dana', ...longbowsThenInn(discarded) })
        expect(() => engine.runNext(resolveOf(TENTS), state, game)).toThrow(OVER(1))
        const accepted = new HydratedOathGameState(
            engine.runNext(resolveOf(WAGON), state, game).updatedState
        )
        expect(accepted.getPlayerState('dana').knownAdviserIds()).toEqual([
            LAND_WARDEN,
            TENTS,
            LONGBOWS
        ])
    })
})

describe('the discards an adviser play may make', () => {
    it('only those that meet the limit, in row order; at the limit of three every adviser may go', () => {
        const wagon = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS)])
        expect(adviserPlayDiscardSets(wagon, 'dana', WOLVES, FACEUP)).toEqual([[WAGON], [SCOUTS]])
        const plain = searched(FIXED, [up(SCOUTS), up(TENTS), up(KEEP)])
        expect(adviserPlayDiscardSets(plain, 'dana', WOLVES, FACEUP)).toEqual([[SCOUTS], [TENTS]])
    })

    it('two discards for Insomnia kept faceup: each pair that leaves two advisers', () => {
        const s = searched(FIXED, [up(SCOUTS), up(TENTS), up(KEEP)], [INSOMNIA, FILLER, INN])
        expect(adviserDiscardsNeeded(s, 'dana', INSOMNIA, FACEUP)).toBe(2)
        expect(adviserPlayDiscardSets(s, 'dana', INSOMNIA, FACEUP)).toEqual([[SCOUTS, TENTS]])
    })

    it('two discards under the Wagon: each pair that leaves one non-Nomad, or goes with the Wagon', () => {
        const s = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS), down(ELDERS)])
        expect(adviserDiscardsNeeded(s, 'dana', WOLVES, FACEUP)).toBe(2)
        expect(adviserPlayDiscardSets(s, 'dana', WOLVES, FACEUP)).toEqual([
            [WAGON, SCOUTS],
            [WAGON, TENTS],
            [WAGON, ELDERS],
            [SCOUTS, ELDERS]
        ])
        expect(checkOf(s, keptAs(s, WOLVES, [SCOUTS, TENTS]))).toBe(OVER(1))
        expect(checkOf(s, keptAs(s, WOLVES, [TENTS, WAGON]))).toBeUndefined()
    })

    it('with room, one set and nothing in it', () => {
        const s = searched(FIXED, [up(SCOUTS)])
        expect(adviserPlayDiscardSets(s, 'dana', WOLVES, FACEUP)).toEqual([[]])
    })

    it("on Dana's own view: the same sets, with neither the state copied nor changed", () => {
        const s = searched(FIXED, [up(WAGON), up(TENTS), down(ELDERS)])
        const server = JSON.stringify(s.dehydrate())
        const own = ownView(s)
        expect(adviserPlayDiscardSets(own, 'dana', WOLVES, FACEUP)).toEqual([[WAGON], [ELDERS]])
        expect(adviserPlayDiscardSets(own, 'dana', WOLVES, FACEUP)).toEqual(
            adviserPlayDiscardSets(s, 'dana', WOLVES, FACEUP)
        )
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    it('before revision 31 every discardable adviser may go, as before', () => {
        const s = searched(BEFORE, [up(WAGON), up(SCOUTS), up(TENTS)])
        expect(adviserPlayDiscardSets(s, 'dana', WOLVES, FACEUP)).toEqual([
            [WAGON],
            [SCOUTS],
            [TENTS]
        ])
    })
})

describe('before revision 31 a game keeps the check it was recorded with', () => {
    it('the Wolves kept faceup over Tents is accepted, and leaves Dana over the limit as it did', () => {
        const s = searched(BEFORE, [up(WAGON), up(SCOUTS), up(TENTS)])
        expect(checkOf(s, keptAs(s, WOLVES, [TENTS]))).toBeUndefined()
        resolve(s, keptAs(s, WOLVES, [TENTS]))
        expect(advisersOf(s)).toEqual([WAGON, SCOUTS, WOLVES])
        expect(advisersOverLimit(s, 'dana')).toBe(1)
    })

    it('over three Nomads, discarding the Wagon is accepted', () => {
        const s = searched(BEFORE, [up(WAGON), up(SCOUTS), up(TENTS), up(ELDERS), up(STEED)])
        expect(checkOf(s, keptAs(s, WOLVES, [WAGON]))).toBeUndefined()
    })

    it('a facedown Wolves played faceup over Tents is accepted', () => {
        const s = table(BEFORE, [up(WAGON), up(SCOUTS), up(TENTS), down(WOLVES)])
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', {
                cardId: WOLVES,
                play: SearchPlay.Adviser,
                discardedAdviserCardIds: [TENTS]
            })
        ).toBeUndefined()
    })
})

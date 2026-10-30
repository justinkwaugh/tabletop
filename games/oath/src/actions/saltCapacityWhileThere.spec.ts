import { describe, expect, it } from 'vitest'
import {
    Color,
    GameEngine,
    GameStatus,
    PlayerStatus as SeatStatus,
    type Game,
    type GameAction,
    type Player
} from '@tabletop/common'
import { BuildOrRepairEdifice } from './buildOrRepairEdifice.js'
import { ChooseOath } from './chooseOath.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { OathType, PlayerStatus } from '../model/oathEnums.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { WinKind } from '../model/ending.js'
import { Definition } from '../definition/runtime.js'
import { buildAction } from '../testing/actions.js'
import { engine } from '../testing/engine.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { wonTable, writeChronicleThrough } from '../testing/chronicle.js'
import { wholeWorld } from '../testing/chronicleWorld.js'
import { FESTIVAL_DISTRICT, HALL_OF_DEBATE, WOLVES } from '../testing/edifices.js'
import { served } from '../testing/projection.js'
import { discardDenizensAtSites } from '../powers/vocabulary.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { edificeChoices } from '../util/chronicleChoices.js'
import { detachFromPlay } from '../util/discard.js'
import { OathRevision } from '../util/revision.js'
import type { GameOutcome } from '../util/victory.js'
import '../powers/index.js'

// Salt the Earth: "This site's capacity is now 1." Its Q&A, on the Drowned City and Festival District: once it is
// gone, the site has no capacity for cards. From revision 31 the capacity of 1 holds exactly while the card is at
// the site (R-7-H1), and the Chronicle builds in its place only where the site's own capacity holds the edifice.

const SALT = 'denizen.discord.salt-the-earth'
const WELCOMING = 'denizen.hearth.welcoming-party'
const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const PEOPLE: readonly [string, string][] = [
    [DANA, 'Dana'],
    [RHYS, 'Rhys'],
    [ANN, 'Ann']
]

const PLAINS = 'site.plains'
const DROWNED_CITY = 'site.drowned-city'
const RIVER = 'site.river'

const SITES = {
    c1: PLAINS,
    c2: RIVER,
    p1: 'site.ancient-city',
    p2: DROWNED_CITY,
    p3: 'site.lush-coast',
    h1: 'site.deep-woods',
    h2: 'site.wastes',
    h3: 'site.mountain'
}

const AFTER = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const SUCCESSOR: GameOutcome = { winnerPlayerId: ANN, kind: WinKind.Successor, rule: 'R-3.3.1' }

function seat(
    playerId: string,
    color: Color,
    status: PlayerStatus,
    siteId: string
): OathPlayerState {
    return testPlayer({ playerId, color, status, siteId })
}

/**
 * Round 6 as Ann, a Citizen, takes the empire: Ann rules the Plains (c1) and the Drowned City (p2) with the
 * Chancellor's warbands, Rhys the River (c2). Every slot holding Salt the Earth has its capacity of 1.
 */
function table(
    revision: OathRevision,
    denizensBySite: Record<string, string[]>
): HydratedOathGameState {
    return wholeWorld(
        testState(
            [
                seat(DANA, Color.Purple, PlayerStatus.Chancellor, 'c1'),
                seat(RHYS, Color.Red, PlayerStatus.Exile, 'c2'),
                seat(ANN, Color.Blue, PlayerStatus.Citizen, 'c1')
            ],
            {
                oathRevision: revision,
                table: {
                    name: 'Thursday table',
                    date: '2026-10-22',
                    seatNames: Object.fromEntries(PEOPLE)
                },
                oathType: OathType.Protection,
                siteCards: SITES,
                warbandsBySite: {
                    c1: { [IMPERIAL_WARBANDS]: 2 },
                    p2: { [IMPERIAL_WARBANDS]: 1 },
                    c2: { [RHYS]: 2 }
                },
                denizensBySite,
                siteCapacityOverrides: Object.fromEntries(
                    Object.entries(denizensBySite)
                        .filter(([, cards]) => cards.includes(SALT))
                        .map(([slot]) => [slot, 1])
                )
            }
        )
    )
}

const GAME = testGame([DANA, RHYS, ANN])

function run(state: OathProjectedState, ...steps: GameAction[]): OathProjectedState {
    let final = state
    for (const step of steps) final = engine.runNext(step, final, GAME).updatedState
    return final
}

/** Ann has won and vowed Devotion: the Chronicle waits on their build. */
function building(
    revision: OathRevision,
    denizensBySite: Record<string, string[]>
): OathProjectedState {
    return run(
        wonTable(table(revision, denizensBySite), SUCCESSOR),
        buildAction(ChooseOath, { id: 'vow', playerId: ANN, oathType: OathType.Devotion })
    )
}

const build = (siteId: string, cardId: string) =>
    buildAction(BuildOrRepairEdifice, { id: 'build', playerId: ANN, choice: { siteId, cardId } })

const hydrated = (state: OathProjectedState) => new HydratedOathGameState(structuredClone(state))
const annsView = (state: OathProjectedState) =>
    new HydratedOathGameState(served(state, { kind: 'player', playerId: ANN }))

function slotOf(state: OathProjectedState | HydratedOathGameState, siteCardId: string): string {
    const entry = Object.entries(state.siteCards).find(([, id]) => id === siteCardId)
    if (!entry) throw Error(`${siteCardId} is faceup on the map`)
    return entry[0]
}

const offeredAt = (state: HydratedOathGameState, siteId: string) =>
    edificeChoices(state)
        .filter((choice) => choice.siteId === siteId)
        .map((choice) => choice.cardId)

function person(id: string, name: string): Player {
    return { id, isHuman: true, userId: `u-${id}`, name, status: SeatStatus.Joined }
}

/** The next game, opened from the finished one as Continue opens it. */
function nextGameOf(finished: OathProjectedState): OathProjectedState {
    const previousPlayers = PEOPLE.map(([id, name]) => person(id, name))
    const next = testGame([], {
        id: 'game-2',
        status: GameStatus.WaitingToStart,
        hotseat: false,
        continuedFromGameId: finished.gameId,
        players: PEOPLE.map(([id, name]) => person(`next-${id}`, name))
    })
    return new GameEngine(Definition.runtime).startGame(next, {
        masterSeed: '00000000000000000000000000000001',
        continuation: { previousState: finished, previousPlayers }
    }).initialState
}

describe('Salt the Earth at the Drowned City, capacity 0, in the Chronicle', () => {
    it('from revision 31 no build is offered in its place, on Ann’s own view as on the full state', () => {
        const state = building(AFTER, { p2: [SALT], c1: [WOLVES] })
        expect(offeredAt(hydrated(state), 'c1')).toEqual([WOLVES])
        expect(offeredAt(hydrated(state), 'p2')).toEqual([])
        expect(edificeChoices(annsView(state))).toEqual(edificeChoices(hydrated(state)))
    })

    it('from revision 31 the build in its place is refused', () => {
        const state = building(AFTER, { p2: [SALT], c1: [WOLVES] })
        expect(() => run(state, build('p2', SALT))).toThrow(
            'Drowned City has no room for an edifice once Salt the Earth is gone'
        )
    })

    it('at revision 30 Festival District is offered in its place and built, as before', () => {
        const state = building(BEFORE, { p2: [SALT] })
        expect(edificeChoices(hydrated(state))).toContainEqual({
            siteId: 'p2',
            cardId: SALT,
            edificeId: FESTIVAL_DISTRICT,
            repair: false
        })
        const built = hydrated(run(state, build('p2', SALT)))
        const slot = slotOf(built, DROWNED_CITY)
        expect(built.denizensAt(slot)).toEqual([FESTIVAL_DISTRICT])
        expect(effectiveSiteCapacity(built, slot)).toBe(1)
    })

    it('from revision 31 a site over its capacity keeps it while Salt the Earth stays: the build beside it is offered, not the one in its place', () => {
        const state = building(AFTER, { p2: [SALT, WELCOMING] })
        expect(offeredAt(hydrated(state), 'p2')).toEqual([WELCOMING])
        const built = hydrated(run(state, build('p2', WELCOMING)))
        const slot = slotOf(built, DROWNED_CITY)
        expect(built.denizensAt(slot)).toEqual([HALL_OF_DEBATE, SALT])
        expect(effectiveSiteCapacity(built, slot)).toBe(1)
    })
})

describe('Festival District built in Salt the Earth’s place at the Plains', () => {
    it('from revision 31 the Plains is back to its own capacity of 3, on Ann’s own view too', () => {
        const state = building(AFTER, { c1: [SALT] })
        expect(offeredAt(hydrated(state), 'c1')).toEqual([SALT])
        const built = run(state, build('c1', SALT))
        const slot = slotOf(built, PLAINS)
        expect(hydrated(built).denizensAt(slot)).toEqual([FESTIVAL_DISTRICT])
        expect(effectiveSiteCapacity(hydrated(built), slot)).toBe(3)
        expect(effectiveSiteCapacity(annsView(built), slot)).toBe(3)
    })

    it('from revision 31 the next game opens with the Plains at 3', () => {
        const { final } = writeChronicleThrough(
            GAME,
            run(building(AFTER, { c1: [SALT] }), build('c1', SALT))
        )
        const next = nextGameOf(final)
        const slot = slotOf(next, PLAINS)
        expect(hydrated(next).denizensAt(slot)).toEqual([FESTIVAL_DISTRICT])
        expect(effectiveSiteCapacity(hydrated(next), slot)).toBe(3)
    })

    it('from revision 31, beside a card Salt the Earth could not discard, the Plains holds both at 3', () => {
        const state = building(AFTER, { c1: [SALT, WELCOMING] })
        expect(offeredAt(hydrated(state), 'c1')).toEqual([SALT, WELCOMING])
        const built = hydrated(run(state, build('c1', SALT)))
        const slot = slotOf(built, PLAINS)
        expect(built.denizensAt(slot)).toEqual([FESTIVAL_DISTRICT, WELCOMING])
        expect(effectiveSiteCapacity(built, slot)).toBe(3)
    })

    it('at revision 30 the Plains keeps the capacity of 1, as before', () => {
        const built = hydrated(run(building(BEFORE, { c1: [SALT] }), build('c1', SALT)))
        const slot = slotOf(built, PLAINS)
        expect(built.denizensAt(slot)).toEqual([FESTIVAL_DISTRICT])
        expect(effectiveSiteCapacity(built, slot)).toBe(1)
    })
})

describe('Salt the Earth discarded with the ruin a site the winner does not rule sets aside (R-8.3.3)', () => {
    const ruined = (revision: OathRevision) => {
        const { final } = writeChronicleThrough(
            GAME,
            building(revision, { c2: [HALL_OF_DEBATE, SALT] })
        )
        return { final, slot: slotOf(final, RIVER) }
    }

    it('from revision 31 the River is back to its own capacity of 2 where it is placed, and in the next game', () => {
        const { final, slot } = ruined(AFTER)
        expect(hydrated(final).denizensAt(slot)).toEqual([HALL_OF_DEBATE])
        expect(hydrated(final).isRuined(HALL_OF_DEBATE)).toBe(true)
        expect(effectiveSiteCapacity(hydrated(final), slot)).toBe(2)
        const next = nextGameOf(final)
        expect(effectiveSiteCapacity(hydrated(next), slotOf(next, RIVER))).toBe(2)
    })

    it('at revision 30 the River keeps the capacity of 1, as before', () => {
        const { final, slot } = ruined(BEFORE)
        expect(hydrated(final).denizensAt(slot)).toEqual([HALL_OF_DEBATE])
        expect(effectiveSiteCapacity(hydrated(final), slot)).toBe(1)
    })
})

describe('Salt the Earth in a game', () => {
    it('is locked: a discard of every denizen at its site leaves it, and its capacity of 1', () => {
        const s = table(AFTER, { c1: [SALT] })
        discardDenizensAtSites(s, DANA, ['c1'], () => true, 'denizen.beast.roving-terror')
        expect(s.denizensAt('c1')).toEqual([SALT])
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)
    })

    it('from revision 31 a site Salt the Earth has left by any route has its own capacity', () => {
        const s = table(AFTER, { c1: [SALT] })
        detachFromPlay(s, SALT)
        expect(effectiveSiteCapacity(s, 'c1')).toBe(3)
    })

    it('at revision 30 the capacity of 1 stays, as before', () => {
        const s = table(BEFORE, { c1: [SALT] })
        detachFromPlay(s, SALT)
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)
    })
})

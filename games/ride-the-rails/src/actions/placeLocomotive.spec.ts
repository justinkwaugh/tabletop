import { ActionSource, latestPlayerUndoTarget } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { hexIdAt, type HexId } from '../data/hexes.js'
import { RAILROAD_IDS, type RailroadId } from '../data/railroads.js'
import { adjacentHexIds, hexById } from '../data/boardMaps.js'
import { USA_HEXES } from '../data/usaMap.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import type { HydratedRideTheRailsGameState, Track } from '../model/gameState.js'
import type { Shares } from '../model/playerState.js'
import { legalPlacements, placementsLeft, placementTest, startCityIds } from '../rules/placement.js'
import { westernmostOccupiedCities } from '../rules/startRailroad.js'
import {
    buildState,
    buildingMetadataOf,
    hydrated,
    runAction,
    undoRun,
    type StateRecipe
} from '../testing/fixtures.js'
import { greaterGermanyOneShort } from '../testing/greaterGermany.js'
import { intercolonialOneShort } from '../testing/intercolonial.js'
import { HydratedPlaceLocomotive } from './placeLocomotive.js'

const NEW_YORK: HexId = 'hex.usa.6-60'
const PHILADELPHIA: HexId = 'hex.usa.7-57'
const WEST_OF_PHILADELPHIA: HexId = 'hex.usa.7-55'
const MOUNTAIN_NEXT_TO_PHILADELPHIA: HexId = 'hex.usa.6-56'
const CHICAGO: HexId = 'hex.usa.5-43'
const KANSAS_CITY: HexId = 'hex.usa.8-32'
const RENO: HexId = 'hex.usa.7-7'
const BOISE: HexId = 'hex.usa.4-10'
const POCATELLO: HexId = 'hex.usa.4-16'
const SALT_LAKE_CITY: HexId = 'hex.usa.6-16'
const DENVER: HexId = 'hex.usa.8-22'
const SEATTLE: HexId = 'hex.usa.0-4'
const OFF_MAP: HexId = 'hex.usa.99-99'

const EVERY_SHARE: Shares = Object.fromEntries(RAILROAD_IDS.map((railroadId) => [railroadId, 1]))

// Occupied western cities: Reno 7, Boise 10, Pocatello and Salt Lake City tied at 16, Denver 22.
const WESTERN_TRACK: Track = {
    [RENO]: ['railroad.purple'],
    [BOISE]: ['railroad.purple', 'railroad.black'],
    [POCATELLO]: ['railroad.black'],
    [SALT_LAKE_CITY]: ['railroad.orange'],
    [DENVER]: ['railroad.orange'],
    [NEW_YORK]: ['railroad.red']
}

const CHICAGO_BONUS = { bonusId: 'bonus.usa.chicago', amount: 2, cityId: 'city.usa.chicago' }

function building(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
    return buildState({
        round: 6,
        phase: PhaseName.Build,
        shares: { p1: EVERY_SHARE, p2: { 'railroad.blue': 1 } },
        money: { p1: 10, p2: 10, p3: 10 },
        track: { [PHILADELPHIA]: ['railroad.red'] },
        ...recipe
    })
}

function placeAction(railroadId: RailroadId, hexId: HexId, playerId = 'p1') {
    return new HydratedPlaceLocomotive({
        id: 'a',
        gameId: 'g',
        source: ActionSource.User,
        type: ActionType.PlaceLocomotive,
        playerId,
        railroadId,
        hexId
    })
}

function place(
    state: HydratedRideTheRailsGameState,
    railroadId: RailroadId,
    hexId: HexId,
    playerId = 'p1'
) {
    return runAction(state, {
        type: ActionType.PlaceLocomotive,
        playerId,
        railroadId,
        hexId
    })
}

function row(rowNumber: number, fromDcol: number, toDcol: number): HexId[] {
    const hexIds: HexId[] = []
    for (let dcol = fromDcol; dcol <= toDcol; dcol += 2) {
        hexIds.push(hexIdAt({ row: rowNumber, dcol }))
    }
    return hexIds
}

function trackOf(...runs: [RailroadId, HexId[]][]): Track {
    const track: Track = {}
    for (const [railroadId, hexIds] of runs) {
        for (const hexId of hexIds) {
            track[hexId] = [...(track[hexId] ?? []), railroadId]
        }
    }
    return track
}

function plainNextTo(hexId: HexId): HexId {
    const plain = adjacentHexIds(hexId).find((adjacent) => hexById(adjacent).terrain === 'plain')
    if (!plain) {
        throw new Error(`No plain hex next to ${hexId}`)
    }
    return plain
}

describe('PlaceLocomotive is the placement test (R-3.2, R-4.1, R-4.2)', () => {
    it('accepts exactly the placements the placement test passes, with its reason otherwise', () => {
        const state = building({ track: WESTERN_TRACK })
        for (const railroadId of RAILROAD_IDS) {
            for (const hex of USA_HEXES) {
                expect(placeAction(railroadId, hex.id).verdict(state)).toEqual(
                    placementTest(state, 'p1', railroadId, hex.id)
                )
            }
        }
    })

    it('refuses an illegal placement with the placement test’s reason', () => {
        const state = building()
        expect(placeAction('railroad.blue', PHILADELPHIA, 'p1').verdict(state)).toEqual({
            legal: false,
            reason: 'hex-at-capacity'
        })
        expect(() => place(state, 'railroad.red', PHILADELPHIA)).toThrow()
        expect(() => placeAction('railroad.red', PHILADELPHIA).apply(state)).toThrow(
            /railroad-in-hex/
        )
    })

    it('refuses an off-map hex at validation instead of throwing', () => {
        const action = placeAction('railroad.red', OFF_MAP)
        expect(action.verdict(building())).toEqual({ legal: false, reason: 'off-map' })
        expect(() => action.apply(building())).toThrow(/off-map/)
    })

    it('refuses a placement outside the player’s building turn (R-3.2.1)', () => {
        expect(
            placeAction('railroad.blue', WEST_OF_PHILADELPHIA, 'p2').verdict(building())
        ).toEqual({ legal: false, reason: 'not-building-turn' })
        const takingShares = buildState({
            round: 6,
            shares: { p1: EVERY_SHARE },
            currentPlayerId: 'p1'
        })
        expect(placeAction('railroad.red', NEW_YORK).verdict(takingShares)).toEqual({
            legal: false,
            reason: 'not-building-turn'
        })
    })
})

describe('a placement (R-3.2, R-4.1)', () => {
    it('adds the railroad to the hex after the track already there and counts the placement', () => {
        const state = building({
            track: { [PHILADELPHIA]: ['railroad.red'], [WEST_OF_PHILADELPHIA]: ['railroad.black'] }
        })
        const { after, processed } = place(state, 'railroad.red', WEST_OF_PHILADELPHIA)
        expect(after.track[WEST_OF_PHILADELPHIA]).toEqual(['railroad.black', 'railroad.red'])
        expect(after.building).toEqual({ placed: 1, usedMountain: false })
        expect(processed.map((action) => action.type)).toEqual([ActionType.PlaceLocomotive])
        expect(buildingMetadataOf(processed[0])).toEqual({ isStart: false, bonuses: [] })
    })

    it('marks the turn’s mountain placement (R-3.2.4)', () => {
        const { after } = place(building(), 'railroad.red', MOUNTAIN_NEXT_TO_PHILADELPHIA)
        expect(after.building).toEqual({ placed: 1, usedMountain: true })
    })

    it('records a start', () => {
        const { after, processed } = place(building(), 'railroad.orange', NEW_YORK)
        expect(after.track[NEW_YORK]).toEqual(['railroad.orange'])
        expect(buildingMetadataOf(processed[0])).toEqual({ isStart: true, bonuses: [] })
    })
})

describe('bonuses at the placement (R-3.2.5, R-4.3)', () => {
    it('pays Chicago’s $2 to the placing player, a start included (R-4.3.1)', () => {
        const { after, processed } = place(building(), 'railroad.orange', CHICAGO)
        expect(hydrated(after).getPlayerState('p1').money).toBe(12)
        expect(buildingMetadataOf(processed[0])).toEqual({
            isStart: true,
            bonuses: [CHICAGO_BONUS]
        })
    })

    it('pays a $5 city’s first locomotive (R-4.3.2)', () => {
        const state = building({ track: { [plainNextTo(KANSAS_CITY)]: ['railroad.red'] } })
        const { after, processed } = place(state, 'railroad.red', KANSAS_CITY)
        expect(hydrated(after).getPlayerState('p1').money).toBe(15)
        expect(buildingMetadataOf(processed[0])).toEqual({
            isStart: false,
            bonuses: [
                { bonusId: 'bonus.usa.five-dollar', amount: 5, cityId: 'city.usa.kansas-city' }
            ]
        })
    })

    it('pays and claims the Transcontinental once (R-4.3.3)', () => {
        const track = trackOf(
            ['railroad.purple', [...row(9, 5, 31), KANSAS_CITY]],
            ['railroad.red', row(9, 33, 55)]
        )
        const { after, processed } = place(building({ track }), 'railroad.red', KANSAS_CITY)
        expect(hydrated(after).getPlayerState('p1').money).toBe(22)
        expect(after.transcontinental).toEqual({ playerId: 'p1', amount: 12 })
        expect(buildingMetadataOf(processed[0])).toEqual({
            isStart: false,
            bonuses: [{ bonusId: 'bonus.usa.transcontinental', amount: 12 }]
        })
    })

    it('pays nothing more and leaves the claim when the Transcontinental is taken', () => {
        const track = trackOf(
            ['railroad.purple', [...row(9, 5, 31), KANSAS_CITY]],
            ['railroad.red', row(9, 33, 55)]
        )
        const claim = { playerId: 'p2', amount: 8 }
        const { after } = place(
            building({ track, transcontinental: claim }),
            'railroad.red',
            KANSAS_CITY
        )
        expect(after.transcontinental).toEqual(claim)
        expect(hydrated(after).getPlayerState('p1').money).toBe(10)
    })
})

describe('Yellow’s one start (R-4.2.3)', () => {
    const NOT_ADJACENT = { legal: false, reason: 'not-adjacent-or-start' }

    it('starts in a westernmost city holding exactly one locomotive', () => {
        const { processed } = place(building({ track: WESTERN_TRACK }), 'railroad.yellow', RENO)
        expect(buildingMetadataOf(processed[0])).toEqual({ isStart: true, bonuses: [] })
    })

    it('starts in Chicago, which pays its $2', () => {
        const state = building({ track: { [NEW_YORK]: ['railroad.red'] } })
        const { processed } = place(state, 'railroad.yellow', CHICAGO)
        expect(buildingMetadataOf(processed[0])).toEqual({
            isStart: true,
            bonuses: [CHICAGO_BONUS]
        })
    })

    it('reads the westernmost set from the track before its locomotive is added', () => {
        // New York is the one occupied city, so it is the whole set, and Chicago is no part of it.
        const state = building({ track: { [NEW_YORK]: ['railroad.red'] } })
        expect(westernmostOccupiedCities(state.track)).toEqual(['city.usa.new-york'])
        expect(placeAction('railroad.yellow', CHICAGO).verdict(state)).toEqual({
            legal: true,
            isStart: true
        })
    })

    it.each([
        ['Chicago', CHICAGO, POCATELLO],
        ['a westernmost city', POCATELLO, CHICAGO]
    ])('refuses a second start after one in %s, in the same building turn', (_, first, second) => {
        const started = hydrated(
            place(building({ track: WESTERN_TRACK }), 'railroad.yellow', first).after
        )
        expect(started.building?.placed).toBe(1)
        expect(placeAction('railroad.yellow', second).verdict(started)).toEqual(NOT_ADJACENT)
        expect(() => place(started, 'railroad.yellow', second)).toThrow()
    })

    it.each([
        ['Chicago', CHICAGO, RENO],
        ['a westernmost city', RENO, CHICAGO]
    ])('refuses a second start after one in %s, in a later building turn', (_, first, second) => {
        const later = hydrated(
            place(building({ track: WESTERN_TRACK }), 'railroad.yellow', first).after
        )
        later.building = { placed: 0, usedMountain: false }
        // Other railroads build further west; the westernmost set moves, and still no start opens.
        later.track = { ...later.track, [SEATTLE]: ['railroad.purple'] }
        expect(placeAction('railroad.yellow', second).verdict(later)).toEqual(NOT_ADJACENT)
        expect(placeAction('railroad.yellow', SEATTLE).verdict(later)).toEqual(NOT_ADJACENT)
        expect(() => place(later, 'railroad.yellow', second)).toThrow()
    })

    it.each([
        ['Chicago', CHICAGO],
        ['a westernmost city', POCATELLO]
    ])(
        'lights only hexes next to its own track once it has started in %s (R-4.1.2)',
        (_, first) => {
            const started = hydrated(
                place(building({ track: WESTERN_TRACK }), 'railroad.yellow', first).after
            )
            const yellow = legalPlacements(started, 'p1').filter(
                (placement) => placement.railroadId === 'railroad.yellow'
            )
            expect(yellow.length).toBeGreaterThan(0)
            for (const placement of yellow) {
                expect(placement.isStart).toBe(false)
                expect(adjacentHexIds(placement.hexId)).toContain(first)
            }
            expect(startCityIds(started, 'railroad.yellow')).toEqual([])
        }
    )

    it('builds into Chicago by adjacency after a western start, without a start', () => {
        const state = building({
            track: { ...WESTERN_TRACK, [plainNextTo(CHICAGO)]: ['railroad.yellow'] }
        })
        const { processed } = place(state, 'railroad.yellow', CHICAGO)
        expect(buildingMetadataOf(processed[0])).toEqual({
            isStart: false,
            bonuses: [CHICAGO_BONUS]
        })
    })
})

describe('the turn ends by itself when nothing more is legal (R-3.2.3, R-3.2.4)', () => {
    it('follows the placement that reaches the limit with FinishBuilding', () => {
        const state = building({ playerCount: 4, building: { placed: 4, usedMountain: false } })
        const { after, processed } = place(state, 'railroad.red', WEST_OF_PHILADELPHIA)
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.PlaceLocomotive,
            ActionType.FinishBuilding
        ])
        expect(processed[1]).toMatchObject({
            source: ActionSource.System,
            playerId: 'p1',
            metadata: { reason: 'limit', placed: 5 }
        })
        expect(after.activePlayerIds).toEqual(['p2'])
        expect(after.building).toEqual({ placed: 0, usedMountain: false })
    })

    it('ends the turn on a mountain placement that lowers the limit to the count', () => {
        const state = building({ playerCount: 4, building: { placed: 3, usedMountain: false } })
        const { processed } = place(state, 'railroad.red', MOUNTAIN_NEXT_TO_PHILADELPHIA)
        expect(buildingMetadataOf(processed[1])).toEqual({ reason: 'limit', placed: 4 })
    })

    it('ends the turn when the last locomotive of the player’s only railroad is placed', () => {
        const state = building({
            shares: { p1: { 'railroad.red': 20 }, p2: { 'railroad.red': 5 } }
        })
        const { processed } = place(state, 'railroad.red', WEST_OF_PHILADELPHIA)
        expect(buildingMetadataOf(processed[1])).toEqual({ reason: 'nothing-legal', placed: 1 })
    })

    it('lets the turn go on while a placement is legal', () => {
        const state = building({ playerCount: 4, building: { placed: 3, usedMountain: false } })
        const { after, processed } = place(state, 'railroad.red', WEST_OF_PHILADELPHIA)
        expect(processed).toHaveLength(1)
        expect(after.building).toEqual({ placed: 4, usedMountain: false })
    })
})

describe('Undo of a placement (R-5)', () => {
    it('takes back that one locomotive with the bonuses it paid', () => {
        const track = trackOf(
            ['railroad.purple', [...row(9, 5, 31), KANSAS_CITY]],
            ['railroad.red', row(9, 33, 55)]
        )
        const run = place(building({ track }), 'railroad.red', KANSAS_CITY)
        expect(run.processed).toHaveLength(1)
        expect(latestPlayerUndoTarget(run.processed, 'p1')?.type).toBe(ActionType.PlaceLocomotive)
        expect(undoRun(run)).toEqual(run.before)
    })

    it('reverses the FinishBuilding the placement triggered with it', () => {
        const state = building({ playerCount: 4, building: { placed: 4, usedMountain: false } })
        const run = place(state, 'railroad.orange', CHICAGO)
        expect(run.processed.map((action) => action.type)).toEqual([
            ActionType.PlaceLocomotive,
            ActionType.FinishBuilding
        ])
        expect(latestPlayerUndoTarget(run.processed, 'p1')?.type).toBe(ActionType.PlaceLocomotive)
        expect(undoRun(run)).toEqual(run.before)
    })

    it('walks a building turn back one locomotive at a time', () => {
        const first = place(building(), 'railroad.red', WEST_OF_PHILADELPHIA)
        const second = place(
            hydrated(first.after),
            'railroad.red',
            plainNextTo(WEST_OF_PHILADELPHIA)
        )
        expect(undoRun(second)).toEqual(first.after)
        expect(undoRun(first)).toEqual(first.before)
    })
})

describe('Australia (R-8.2)', () => {
    const ADELAIDE: HexId = 'hex.au.4-14'
    const LONG_DISTANCE_NEXT_TO_ADELAIDE: HexId = 'hex.au.3-13'
    const PERTH_CHAIN_END: HexId = 'hex.au.1-13'
    const PERTH: HexId = 'hex.au.0-12'
    const BRISBANE_CHAIN_END: HexId = 'hex.au.34-8'
    const BRISBANE: HexId = 'hex.au.34-6'

    function australia(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
        return building({
            mapId: 'map.au',
            track: { [ADELAIDE]: ['railroad.orange'] },
            ...recipe
        })
    }

    it('ends the turn with a long-distance placement, the reason long-distance, though placements are left', () => {
        const { after, processed } = place(
            australia(),
            'railroad.orange',
            LONG_DISTANCE_NEXT_TO_ADELAIDE
        )
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.PlaceLocomotive,
            ActionType.FinishBuilding
        ])
        expect(processed[1]).toMatchObject({
            source: ActionSource.System,
            playerId: 'p1',
            metadata: { reason: 'long-distance', placed: 1 }
        })
        expect(after.track[LONG_DISTANCE_NEXT_TO_ADELAIDE]).toEqual(['railroad.orange'])
        expect(after.activePlayerIds).toEqual(['p2'])
        expect(after.building).toEqual({ placed: 0, usedMountain: false })
    })

    const atPerthsChainEnd = (recipe: StateRecipe = {}) =>
        australia({
            track: {
                [ADELAIDE]: ['railroad.orange'],
                [PERTH_CHAIN_END]: ['railroad.orange'],
                [BRISBANE_CHAIN_END]: ['railroad.red']
            },
            ...recipe
        })

    it('pays Perth’s $50 to the turn’s first placement, which builds into it and ends the turn', () => {
        const { after, processed } = place(atPerthsChainEnd(), 'railroad.orange', PERTH)
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.PlaceLocomotive,
            ActionType.FinishBuilding
        ])
        expect(processed[0]).toMatchObject({
            metadata: {
                isStart: false,
                bonuses: [{ bonusId: 'bonus.au.perth', amount: 50, cityId: 'city.au.perth' }]
            }
        })
        expect(processed[1]).toMatchObject({
            source: ActionSource.System,
            playerId: 'p1',
            metadata: { reason: 'long-distance', placed: 1 }
        })
        expect(hydrated(after).getPlayerState('p1').money).toBe(60)
        expect(after.activePlayerIds).toEqual(['p2'])
    })

    it('pays Brisbane’s $20 to the turn’s first placement, which builds into it and ends the turn', () => {
        const { after, processed } = place(atPerthsChainEnd(), 'railroad.red', BRISBANE)
        expect(processed[0]).toMatchObject({
            metadata: {
                isStart: false,
                bonuses: [{ bonusId: 'bonus.au.brisbane', amount: 20, cityId: 'city.au.brisbane' }]
            }
        })
        expect(processed[1]).toMatchObject({ metadata: { reason: 'long-distance', placed: 1 } })
        expect(hydrated(after).getPlayerState('p1').money).toBe(30)
        expect(after.activePlayerIds).toEqual(['p2'])
    })

    it('refuses a placement into Perth or Brisbane after another placement that turn', () => {
        const later = atPerthsChainEnd({ building: { placed: 1, usedMountain: false } })
        expect(placeAction('railroad.orange', PERTH).verdict(later)).toEqual({
            legal: false,
            reason: 'long-distance-not-first'
        })
        expect(placeAction('railroad.red', BRISBANE).verdict(later)).toEqual({
            legal: false,
            reason: 'long-distance-not-first'
        })
    })

    it('refuses Black a start in Perth or Brisbane: no railroad starts there', () => {
        for (const hexId of [PERTH, BRISBANE]) {
            expect(placeAction('railroad.black', hexId).verdict(australia()), hexId).toEqual({
                legal: false,
                reason: 'not-adjacent-or-start'
            })
            expect(() => placeAction('railroad.black', hexId).apply(australia())).toThrow(
                /not-adjacent-or-start/
            )
        }
    })

    it('takes back a long-distance placement and the end of the turn it made (R-5)', () => {
        const run = place(australia(), 'railroad.orange', LONG_DISTANCE_NEXT_TO_ADELAIDE)
        expect(undoRun(run)).toEqual(run.before)
    })
})

describe('Canada (R-8.3)', () => {
    const TORONTO: HexId = 'hex.ca.11-21'
    const NORTH_OF_TORONTO: HexId = 'hex.ca.11-19'

    it('pays Toronto’s $3 for a placement there that is no start', () => {
        const state = building({
            mapId: 'map.ca',
            track: { [NORTH_OF_TORONTO]: ['railroad.red'], [TORONTO]: ['railroad.purple'] }
        })
        const { after, processed } = place(state, 'railroad.red', TORONTO)
        expect(processed[0]).toMatchObject({
            metadata: {
                isStart: false,
                bonuses: [{ bonusId: 'bonus.ca.toronto', amount: 3, cityId: 'city.ca.toronto' }]
            }
        })
        expect(hydrated(after).getPlayerState('p1').money).toBe(13)
    })

    it('pays and claims the Intercolonial once, to the first placement that joins its cities', () => {
        const { track, railroadId, hexId } = intercolonialOneShort()
        const { after, processed } = place(building({ mapId: 'map.ca', track }), railroadId, hexId)
        expect(processed[0]).toMatchObject({
            metadata: { bonuses: [{ bonusId: 'bonus.ca.intercolonial', amount: 8 }] }
        })
        expect(after.connectionClaim).toEqual({ playerId: 'p1' })
        expect(hydrated(after).getPlayerState('p1').money).toBe(18)
    })
})

describe('France (R-8.4)', () => {
    const PARIS: HexId = 'hex.fr.13-13'

    it('pays Paris’s $10 for a start there', () => {
        const { after, processed } = place(
            building({ mapId: 'map.fr', track: {} }),
            'railroad.purple',
            PARIS
        )
        expect(processed[0]).toMatchObject({
            metadata: {
                isStart: true,
                bonuses: [{ bonusId: 'bonus.fr.paris', amount: 10, cityId: 'city.fr.paris' }]
            }
        })
        expect(hydrated(after).getPlayerState('p1').money).toBe(20)
    })
})

describe('Germany (R-8.5)', () => {
    const STUTTGART: HexId = 'hex.de.8-46'
    const MOUNTAIN_NORTH_OF_STUTTGART: HexId = 'hex.de.8-44'
    const BERLIN: HexId = 'hex.de.19-17'

    function germany(track: Track) {
        return building({ mapId: 'map.de', track, building: { placed: 0, usedMountain: false } })
    }

    it('leaves the limit and the turn’s mountain charge alone for Orange’s mountain placement', () => {
        const state = germany({ [STUTTGART]: ['railroad.orange', 'railroad.red'] })
        const { after } = place(state, 'railroad.orange', MOUNTAIN_NORTH_OF_STUTTGART)
        expect(after.building).toEqual({ placed: 1, usedMountain: false })
        expect(placementsLeft(hydrated(after))).toBe(7)
    })

    it('spends the charge, once, for another railroad’s mountain placement', () => {
        const state = germany({ [STUTTGART]: ['railroad.orange', 'railroad.red'] })
        const { after } = place(state, 'railroad.red', MOUNTAIN_NORTH_OF_STUTTGART)
        expect(after.building).toEqual({ placed: 1, usedMountain: true })
        expect(placementsLeft(hydrated(after))).toBe(6)
    })

    it('pays Berlin’s $3 for a start there', () => {
        const { after, processed } = place(germany({}), 'railroad.purple', BERLIN)
        expect(processed[0]).toMatchObject({
            metadata: {
                isStart: true,
                bonuses: [{ bonusId: 'bonus.de.berlin', amount: 3, cityId: 'city.de.berlin' }]
            }
        })
        expect(hydrated(after).getPlayerState('p1').money).toBe(13)
    })

    it('pays and claims Greater Germany once, to the first placement that joins its five cities', () => {
        const { track, railroadId, hexId } = greaterGermanyOneShort()
        const { after, processed } = place(germany(track), railroadId, hexId)
        expect(processed[0]).toMatchObject({
            metadata: { bonuses: [{ bonusId: 'bonus.de.greater-germany', amount: 12 }] }
        })
        expect(after.connectionClaim).toEqual({ playerId: 'p1' })
        expect(hydrated(after).getPlayerState('p1').money).toBe(22)
    })
})

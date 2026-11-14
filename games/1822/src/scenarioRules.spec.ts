import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
    RailwayMapState,
    getCompany,
    placeStockMarker,
    rotateTileFace,
    tileExits,
    type TileRotation
} from '@tabletop/18xx'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { SetupSeeds, boxLot, kit, prepared } from '../test/kit.js'
import { cashOf, company, layTiles, player, runMinor, spaceAt, stepTo } from '../test/positions.js'
import {
    LondonLocationId,
    MajorIds1822,
    Majors1822,
    MetropolitanId,
    MinorIds1822,
    Minors1822,
    concessionId
} from './companies.js'
import { firstTrainOffer1822, metropolitanHomeSlot1822 } from './housekeeping.js'
import { bidBoxId1822 } from './lots.js'
import { Map1822 } from './map.js'
import { EndingRules1822, TrainRules1822 } from './operating.js'
import { OutOfPlayTileId1822 } from './overlays.js'
import { RouteRules1822 } from './routes.js'
import type { ScenarioId1822 } from './scenarioCatalog.js'
import { MajorRemovalGroups1822, Scenarios1822 } from './scenarios.js'
import type { State1822 } from './state.js'
import { StockRules1822 } from './stock.js'
import { TileSet1822, Tiles1822 } from './tiles.js'
import { TrackRules1822 } from './track.js'
import { TrainDepot1822 } from './trains.js'

const table = (scenario: ScenarioId1822, count = 4, seed = 3) =>
    kit.table(count, seed, { scenario })

/** A prepared table of the scenario, in phase 3 unless another is given. */
const playing = (
    scenario: ScenarioId1822,
    prepare: (state: State1822, players: string[]) => void,
    phaseId = '3'
) => prepared(prepare, { config: { scenario }, phaseId })

const inPlay = (state: State1822, kind: string) =>
    state.companies.filter((entry) => entry.kind === kind).map((entry) => entry.id)
describe.each(Scenarios1822)('the $name scenario (scenario pack)', (scenario) => {
    it.each([3, 4, 5, 6, 7])('gives %i players its start money and share limit', (count) => {
        const { state, hydrated } = table(scenario.id, count)
        const [first] = state.turnManager.turnOrder
        expect(cashOf(state, player(first))).toBe(scenario.startingCash[count])
        const total = state.cash
            .filter((entry) => entry.owner.kind !== 'company')
            .reduce((sum, entry) => sum + (entry.amount ?? 0), 0)
        expect(total).toBe(scenario.bank)
        expect(StockRules1822.certificateLimit(hydrated, player(first))).toBe(
            scenario.certificateLimits[count]
        )
    })

    it('holds its numbers of trains', () => {
        const { state } = table(scenario.id)
        for (const [definitionId, count] of Object.entries(scenario.trains))
            expect(TrainDepot1822.remaining(state.trainInventory, definitionId)).toBe(count)
        expect(TrainDepot1822.remaining(state.trainInventory, '7')).toBe('unlimited')
    })

    it('ends the game at its share value', () => {
        const game = playing(scenario.id, (state, [first]) => {
            const [majorId] = state.companies
                .filter((entry) => entry.kind === 'major')
                .map((entry) => entry.id)
            kit.operated(state, majorId, first, { price: 100, shares: 6, cash: 400 })
            placeStockMarker(state.stockMarket, majorId, spaceAt(330))
        })
        expect(EndingRules1822.trigger(game.hydrated)).toBeUndefined()
        const state = structuredClone(game.state)
        const [majorId] = inPlay(state, 'major')
        placeStockMarker(state.stockMarket, majorId, spaceAt(scenario.endPrice))
        game.state = state
        expect(EndingRules1822.trigger(game.hydrated)?.reason).toBe(
            'Share value at the game end value'
        )
    })

    it('sells a minor company its first L train for £10 less', () => {
        const [minorId] = inPlay(table(scenario.id).state, 'minor').filter(
            (id) => id !== MetropolitanId
        )
        const game = playing(
            scenario.id,
            (state, [first]) => {
                runMinor(state, minorId, first, { cash: 100, operated: false })
                state.debutCompanyIds = [minorId]
            },
            '1'
        )
        stepTo(game, 'LayingTrack', minorId)
        expect(firstTrainOffer1822(game.hydrated, game.player)?.price).toBe(50)
    })

    it('flips an L train to a 2-train at its price', () => {
        const price = (phaseId: string) => {
            const game = playing(scenario.id, () => undefined, phaseId)
            const [minorId] = inPlay(game.state, 'minor')
            return TrainRules1822.exchangePrice?.(game.hydrated, minorId, '2', {
                id: 'L-1',
                definitionId: 'L',
                status: 'owned',
                owner: company(minorId)
            })
        }
        expect(price('1')).toBe(scenario.localUpgradePrices['1'])
        expect(price('2')).toBe(scenario.localUpgradePrices['2'])
        expect(price('3')).toBeUndefined()
    })

    it('keeps every company it plays with on the map it plays on', () => {
        const { state } = table(scenario.id)
        const out = scenario.overlays.flatMap((overlay) => [
            ...overlay.outOfPlay,
            ...overlay.stations.map((station) => station.locationId),
            ...overlay.approaches.map((approach) => approach.locationId)
        ])
        const homes = [...Majors1822, ...Minors1822].filter(
            (entry) => entry.home && state.companies.some((found) => found.id === entry.id)
        )
        expect(homes.filter((entry) => entry.home && out.includes(entry.home.locationId))).toEqual(
            []
        )
        expect(state.stationReservations.filter((entry) => out.includes(entry.locationId))).toEqual(
            []
        )
    })
})

describe('the scenario table', () => {
    it('names only companies of the game', () => {
        const named = Scenarios1822.flatMap(({ minors, majors }) => [
            ...('removedIds' in minors ? minors.removedIds : []),
            ...('removedIds' in majors ? majors.removedIds : majors.groups.flat())
        ])
        expect(named.filter((id) => ![...MajorIds1822, ...MinorIds1822].includes(id))).toEqual([])
        expect(Object.values(MajorRemovalGroups1822).flat().sort()).toEqual(
            [...MajorIds1822].sort()
        )
    })
})

describe('the regional scenarios (General sheet)', () => {
    it.each([
        ['large-regional', 15, ['M1', 'M2', 'M3'], ['CR', 'NBR', 'NER'], 'M24'],
        [
            'medium-regional',
            12,
            ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M22', 'M23'],
            ['CR', 'NBR', 'NER'],
            'M14'
        ],
        [
            'small-regional',
            12,
            ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M19', 'M20', 'M21', 'M22', 'M23', 'M24'],
            ['CR', 'NBR', 'NER', 'SWR'],
            'M14'
        ]
    ] as const)(
        '%s uses privates 1 to %i and plays without its named companies',
        (id, privates, minors, majors, firstMinor) => {
            for (const seed of [1, 2, 3]) {
                const { state } = table(id, 4, seed)
                const open = state.companies.filter(
                    (entry) => entry.kind === 'private' && !entry.closed && /^P\d/.test(entry.id)
                )
                expect(open.map((entry) => entry.id)).toEqual(
                    Array.from({ length: privates }, (_, index) => `P${index + 1}`)
                )
                expect([...(state.removedCompanyIds ?? [])].sort()).toEqual(
                    [...majors, ...minors].sort()
                )
                expect(inPlay(state, 'minor')).toHaveLength(24 - minors.length)
                expect(inPlay(state, 'major')).toHaveLength(10 - majors.length)
                for (const majorId of majors) {
                    expect(state.companies.some((entry) => entry.id === majorId)).toBe(false)
                    expect(
                        state.companies.some((entry) => entry.id === concessionId(majorId))
                    ).toBe(false)
                }
                expect(boxLot(state, bidBoxId1822('minor', 1))).toBe(firstMinor)
            }
        }
    )

    it.each(Scenarios1822.filter((scenario) => scenario.overlays.length))(
        '$name lays its overlays and covers the hexes out of play',
        (scenario) => {
            const { state } = table(scenario.id)
            // The game records only its scenario; the board follows from it.
            expect(state.tileInventory).toEqual({
                variantId: scenario.id,
                placements: {},
                retiredPieceIds: []
            })
            const board = new RailwayMapState(Map1822, TileSet1822, state.tileInventory)
            const placed = (locationId: string) => board.tile(locationId).placement?.definitionId
            for (const overlay of scenario.overlays) {
                for (const station of overlay.stations)
                    expect(placed(station.locationId)).toBe(station.definitionId)
                for (const approach of overlay.approaches)
                    expect(placed(approach.locationId)).toBe(approach.definitionId)
                for (const locationId of overlay.outOfPlay) {
                    expect(Map1822.location(locationId).id).toBe(locationId)
                    expect(placed(locationId), locationId).toBe(OutOfPlayTileId1822)
                }
            }
            // Each tile the scenario plays without is gone from the set.
            for (const [definitionId, count] of Object.entries(scenario.tilesRemoved)) {
                const entry = TileSet1822.counts(state.tileInventory).find(
                    (found) => found.definitionId === definitionId
                )
                expect(entry?.available, definitionId).toBe(Number(entry?.total) - count)
            }
        }
    )
})

describe('the full-map scenarios (General sheet)', () => {
    const groupsOf = (removed: readonly string[]) =>
        Object.values(MajorRemovalGroups1822).map(
            (group) => removed.filter((id) => group.some((member) => member === id)).length
        )

    it.each(SetupSeeds)('remove companies at random within their limits (seed %i)', (seed) => {
        for (const [id, privates, minors, majors] of [
            ['medium-game', 3, 4, 1],
            ['short-game', 6, 8, 2],
            ['mini-game', 9, 12, 3]
        ] as const) {
            const { state } = table(id, 4, seed)
            const removed = state.removedCompanyIds ?? []
            const removedMajors = removed.filter(
                (entry) => !entry.startsWith('M') || entry === 'MR'
            )
            const removedMinors = removed.filter((entry) => /^M\d/.test(entry))
            expect(state.removedPrivateIds).toHaveLength(privates)
            expect(state.removedPrivateIds).not.toContain('P1')
            expect(removedMinors).toHaveLength(minors)
            expect(removedMinors).not.toContain(MetropolitanId)
            expect(removedMajors).toHaveLength(majors)
            const [london, ...others] = groupsOf(removedMajors)
            expect(Math.max(london, ...others)).toBeLessThanOrEqual(1)
            if (id === 'medium-game') expect(london).toBe(0)
            expect(inPlay(state, 'major')).toHaveLength(10 - majors)
            expect(boxLot(state, bidBoxId1822('minor', 1))).toBe(MetropolitanId)
            expect(state.tileInventory.placements).toEqual({})
        }
    })

    function majorLaying(scenario: ScenarioId1822, phaseId: string, laid: readonly string[]) {
        const game = playing(
            scenario,
            (state, [first]) => {
                const [majorId] = inPlay(state, 'major')
                kit.operated(state, majorId, first, { price: 100, shares: 6, cash: 400 })
                kit.giveTrain(state, majorId, '2')
            },
            phaseId
        )
        const [majorId] = inPlay(game.state, 'major')
        stepTo(game, 'LayingTrack', majorId)
        const state = structuredClone(game.state)
        state.trackStep = {
            companyId: majorId,
            completed: false,
            lays: laid.map((definitionId, index) => ({ locationId: `test-${index}`, definitionId }))
        }
        game.state = state
        return (color: string) => !('reason' in TrackRules1822.allowance(game.hydrated, color))
    }
    const Y = '18xx:9'
    const G = '18xx:80'

    it('let a major company lay two yellow tiles from phase 2', () => {
        for (const id of ['medium-game', 'short-game', 'mini-game'] as const) {
            expect(majorLaying(id, '2', [Y])('yellow')).toBe(true)
            expect(majorLaying(id, '2', [Y, Y])('yellow')).toBe(false)
        }
        expect(majorLaying('large-regional', '2', [Y])('yellow')).toBe(false)
    })

    it('let a major company lay a yellow tile and an upgrade from phase 3', () => {
        for (const id of ['medium-game', 'short-game'] as const) {
            expect(majorLaying(id, '3', [Y])('green')).toBe(true)
            expect(majorLaying(id, '3', [G])('yellow')).toBe(true)
            expect(majorLaying(id, '3', [Y, Y])('green')).toBe(false)
            expect(majorLaying(id, '3', [Y, G])('yellow')).toBe(false)
            expect(majorLaying(id, '3', [G])('green')).toBe(false)
        }
        expect(majorLaying('small-regional', '3', [Y])('green')).toBe(false)
    })

    it('let a major company lay three tiles in the Mini Game, two upgrades only of track', () => {
        const laying = (laid: readonly string[]) => majorLaying('mini-game', '3', laid)
        expect(laying([Y, Y])('yellow')).toBe(true)
        expect(laying([Y, Y])('green')).toBe(true)
        expect(laying([Y, G])('green')).toBe(true)
        expect(laying([G, G])('yellow')).toBe(true)
        expect(laying([Y, Y, Y])('yellow')).toBe(false)
        expect(laying([Y, Y, G])('green')).toBe(false)
        expect(laying([G, G])('green')).toBe(false)
        const game = playing('mini-game', () => undefined)
        const state = structuredClone(game.state)
        const [majorId] = inPlay(state, 'major')
        state.trackStep = {
            companyId: majorId,
            completed: false,
            lays: [{ locationId: 'test', definitionId: G }]
        }
        game.state = state
        const second = (definitionId: string) =>
            TrackRules1822.restriction?.(game.hydrated, {
                companyId: majorId,
                locationId: 'M18',
                definitionId,
                rotation: 0,
                nodeMapping: {}
            })
        expect(second('18xx:14')).toBe(
            'Two upgrades in a turn are of track and small stations only.'
        )
        expect(second('18xx:81')).toBeUndefined()
    })

    it('lets the Metropolitan Railway take a removed London company’s station space', () => {
        const seed = SetupSeeds.find((candidate) =>
            table('mini-game', 4, candidate).state.removedCompanyIds?.includes('GWR')
        )
        if (!seed) throw new Error('No seed removes the GWR')
        const game = table('mini-game', 4, seed)
        const home = Majors1822.find((major) => major.id === 'GWR')?.home
        if (!home) throw new Error('The GWR has a home')
        expect(home.locationId).toBe(LondonLocationId)
        expect(metropolitanHomeSlot1822(game.hydrated, home.nodeId)).toBe(0)
        const other = ['s', 'sw', 'nw', 'n', 'ne', 'se'].find(
            (nodeId) =>
                nodeId !== home.nodeId &&
                !Majors1822.some(
                    (major) =>
                        major.home.nodeId === nodeId &&
                        game.state.removedCompanyIds?.includes(major.id)
                )
        )
        expect(metropolitanHomeSlot1822(game.hydrated, other ?? '')).toBe(1)
        // The standard game keeps the Metropolitan Railway on the roundel.
        expect(metropolitanHomeSlot1822(kit.table(4, 3).hydrated, home.nodeId)).toBe(1)
    })
})

describe('routes to an overlay', async () => {
    const autorouter = await Autorouter.create(
        new Uint8Array(
            await readFile(
                createRequire(import.meta.url).resolve('@tabletop/18xx-autorouter/solver.wasm')
            )
        ).buffer
    )
    /** The rotation that gives the tile exactly these sides. */
    function rotated(definitionId: string, exits: readonly number[]): TileRotation {
        const face = Tiles1822.find((tile) => tile.id === definitionId)?.face
        if (!face) throw new Error(`No tile ${definitionId}`)
        const rotation = ([0, 1, 2, 3, 4, 5] as const).find((candidate) => {
            const found = [...tileExits(rotateTileFace(face, candidate))].sort()
            return found.join() === [...exits].sort().join()
        })
        if (rotation === undefined) throw new Error(`Tile ${definitionId} has no such rotation`)
        return rotation
    }

    it('runs from Gloucester through Newport to South Wales and ends there', () => {
        const game = playing('small-regional', (state, [first]) => {
            kit.operated(state, 'GWR', first, { price: 100, shares: 6, cash: 400 })
            kit.giveTrain(state, 'GWR', '3')
            layTiles(state, [
                {
                    locationId: 'H33',
                    definitionId: '18xx:57',
                    rotation: rotated('18xx:57', [1, 4])
                },
                { locationId: 'G34', definitionId: '18xx:4', rotation: rotated('18xx:4', [1, 4]) }
            ])
            const spare = state.stations.find(
                (station) => station.companyId === 'GWR' && station.status === 'available'
            )
            if (!spare) throw new Error('The GWR has a station to place')
            state.stations = state.stations.map((station) =>
                station.id === spare.id
                    ? {
                          id: spare.id,
                          companyId: 'GWR',
                          status: 'placed',
                          position: { locationId: 'H33', nodeId: 'city', slot: 0 }
                      }
                    : station
            )
        })
        stepTo(game, 'RunningTrains', 'GWR')
        const { result } = autorouter.solve(game.hydrated, RouteRules1822, 'GWR', {
            timeLimitMs: 2000
        })
        // Gloucester £20, Newport £10 and South Wales at its green value, £30.
        expect(result.revenue).toBe(60)
        expect(getCompany(game.state, 'GWR').closed).toBeFalsy()
    })
})

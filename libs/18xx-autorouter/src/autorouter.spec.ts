import { readFile } from 'node:fs/promises'
import { beforeAll, expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    TileSet,
    TrainDepot,
    createCityTileFace as city,
    createTownTileFace as town,
    createTrackTileFace as track,
    createOffboardTileFace as offboard,
    createStagedTileRevenue as staged,
    type TileFace,
    type TrainDistance,
    type TrainRunningState,
    type RouteRules
} from '@tabletop/18xx'
import { Autorouter } from './autorouter.js'
import { exhaustiveRevenue } from './testing/exhaustiveRevenue.js'

let router: Autorouter
beforeAll(async () => {
    const bytes = await readFile(new URL('../esm/solver.wasm', import.meta.url))
    router = await Autorouter.create(new Uint8Array(bytes).buffer)
})
function position(faces: TileFace[], distances: TrainDistance[]) {
    const tileSet = new TileSet({ id: 'empty', entries: [] }, [])
    const depot = new TrainDepot({
        id: 'test',
        trains: distances.map((distance, id) => ({
            id: String(id),
            name: String(id),
            price: 0,
            distance
        })),
        supply: []
    })
    const rules: RouteRules = {
        map: new RailwayMap({
            id: 'test',
            name: 'Test',
            orientation: HexOrientation.Flat,
            locations: faces.map((preprintedTile, r) => ({
                id: String(r),
                coordinates: { q: 0, r },
                preprintedTile,
                buildable: true
            }))
        }),
        tileSet,
        depot,
        requiresCity: (train) => train.distance.measure === 'cities-and-offboards',
        revenueStage: (state) => [state.phaseId]
    }
    const state: TrainRunningState = {
        bank: { name: 'Bank' },
        companies: [{ id: 'A', name: 'A', kind: 'major', shareCount: 10 }],
        cash: [],
        certificates: [],
        certificatePools: [],
        stations: [
            {
                id: 'home',
                companyId: 'A',
                status: 'placed',
                position: { locationId: '0', nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: [],
        tileInventory: tileSet.createInventory(),
        trainInventory: {
            depotId: 'test',
            nextTrainNumber: 1,
            trains: distances.map((_, id) => ({
                id: String(id),
                definitionId: String(id),
                status: 'owned',
                owner: { kind: 'company', companyId: 'A' }
            }))
        },
        phaseId: 'yellow',
        routeStep: { companyId: 'A' }
    }
    return { state, rules }
}
it('counts H crossings through corridors rather than revenue centers', () => {
    const { state, rules } = position(
        [
            city('yellow', [0], 20, 1),
            track('yellow', [[3, 0]]),
            city('yellow', [3, 0], 30, 1),
            town('yellow', [[3]], 10)
        ],
        [{ measure: 'hex-edges', maximum: 2 }]
    )
    const result = router.solve(state, rules, 'A')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(50)
    expect(result.result.routes[0].distance).toBe(2)
    expect(result.result.routes[0].paths).toHaveLength(3)
})
it('pays intermediate and trailing towns without using + capacity', () => {
    const { state, rules } = position(
        [
            town('yellow', [[0]], 10),
            city('yellow', [3, 0], 20, 1),
            town('yellow', [[3, 0]], 10),
            city('yellow', [3, 0], 30, 1),
            town('yellow', [[3]], 10)
        ],
        [{ measure: 'cities-and-offboards', maximum: 2 }]
    )
    state.stations[0] = {
        id: 'home',
        companyId: 'A',
        status: 'placed',
        position: { locationId: '1', nodeId: 'city', slot: 0 }
    }
    const result = router.solve(state, rules, 'A')
    expect(result.result.revenue).toBe(80)
    expect(result.result.routes[0].distance).toBe(2)
    expect(result.result.routes[0].visits).toHaveLength(5)
})
it('separates capacities of a mixed fleet and shares stations without sharing track', () => {
    const { state, rules } = position(
        [
            city('yellow', [0], 20, 1),
            town('yellow', [[3, 0]], 10),
            city('yellow', [3, 0], 30, 1),
            city('yellow', [3], 40, 1)
        ],
        [
            { measure: 'hex-edges', maximum: 1 },
            { measure: 'cities-and-offboards', maximum: 2 }
        ]
    )
    state.stations[0] = {
        id: 'home',
        companyId: 'A',
        status: 'placed',
        position: { locationId: '2', nodeId: 'city', slot: 0 }
    }
    const result = router.solve(state, rules, 'A')
    expect(result.result.revenue).toBe(130)
    expect(result.result.routes).toHaveLength(2)
    expect(result.result.routes.find((r) => r.trainId === '1')?.visits).toHaveLength(3)
})
it('uses staged diesel values, has no stop cap and preserves state across repeated calls', () => {
    const { state, rules } = position(
        [
            city('yellow', [0], 20, 1),
            town('yellow', [[3, 0]], 10),
            offboard(
                [3],
                staged([
                    ['yellow', 30],
                    ['diesel', 100]
                ])
            )
        ],
        [{ measure: 'revenue-centers', maximum: 'unlimited' }]
    )
    state.phaseId = 'diesel'
    const before = structuredClone(state)
    for (let i = 0; i < 20; i++) {
        const result = router.solve(state, rules, 'A')
        expect(result.result.revenue).toBe(130)
        expect(result.result.routes[0].visits).toHaveLength(3)
    }
    expect(state).toEqual(before)
})
it('stops at blocked cities, does not treat a reservation as a blocking station', () => {
    const { state, rules } = position(
        [city('yellow', [0], 20, 1), city('yellow', [3, 0], 30, 1), city('yellow', [3], 40, 1)],
        [{ measure: 'revenue-centers', maximum: 3 }]
    )
    state.stations.push({
        id: 'rival',
        companyId: 'B',
        status: 'placed',
        position: { locationId: '1', nodeId: 'city', slot: 0 }
    })
    expect(router.solve(state, rules, 'A').result.revenue).toBe(50)
    state.stations.pop()
    state.stationReservations.push({ companyId: 'B', locationId: '1', nodeId: 'city' })
    expect(router.solve(state, rules, 'A').result.revenue).toBe(90)
})
it('matches exhaustive route enumeration for mixed distance measures on a connected map', () => {
    const { state, rules } = position(
        [
            city('yellow', [0], 20, 1),
            city('yellow', [3, 0], 30, 1),
            town('yellow', [[3, 0]], 10),
            city('yellow', [3], 40, 1)
        ],
        [
            { measure: 'hex-edges', maximum: 2 },
            { measure: 'cities-and-offboards', maximum: 2 }
        ]
    )
    state.stations[0] = {
        id: 'home',
        companyId: 'A',
        status: 'placed',
        position: { locationId: '1', nodeId: 'city', slot: 0 }
    }
    expect(router.solve(state, rules, 'A').result.revenue).toBe(
        exhaustiveRevenue(state, rules, 'A')
    )
})

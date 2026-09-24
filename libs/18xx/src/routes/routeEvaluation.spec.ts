import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { TileSet } from '../tiles/inventory.js'
import {
    createCityTileFace as city,
    createTownTileFace as town,
    createTrackTileFace as track,
    createOffboardTileFace as offboard,
    createStagedTileRevenue as staged
} from '../tiles/faces.js'
import type { TileFace } from '../tiles/tile.js'
import { TrainDepot } from '../trains/trainDepot.js'
import type { TrainDistance } from '../trains/train.js'
import { RouteEvaluation, type RouteRules } from './routeEvaluation.js'
import type { TrainRunningState, TrainRoute } from './route.js'
function fixture(
    faces: TileFace[],
    distance: TrainDistance = { measure: 'revenue-centers', maximum: 3 }
) {
    const map = new RailwayMap({
        id: 'routes',
        name: 'Routes',
        orientation: HexOrientation.Flat,
        locations: faces.map((preprintedTile, r) => ({
            id: String(r),
            coordinates: { q: 0, r },
            preprintedTile,
            buildable: true
        }))
    })
    const tileSet = new TileSet({ id: 'empty', entries: [] }, [])
    const depot = new TrainDepot({
        id: 'trains',
        trains: [{ id: 'train', name: 'Train', price: 100, distance }],
        supply: [{ definitionId: 'train', count: 2 }]
    })
    const state: TrainRunningState = {
        bank: { name: 'Bank' },
        companies: [
            {
                id: 'A',
                name: 'A',
                kind: 'major',
                shareCount: 10,
                president: { kind: 'player', playerId: 'one' }
            }
        ],
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
        trainInventory: depot.createInventory(),
        phaseId: 'yellow',
        routeStep: { companyId: 'A' }
    }
    for (let i = 0; i < 2; i++) {
        const train = depot.nextTrain(state.trainInventory, 'train')!
        depot.purchase(state.trainInventory, train.id, train.definitionId, {
            kind: 'company',
            companyId: 'A'
        })
    }
    const rules: RouteRules = {
        map,
        tileSet,
        depot,
        revenueStage: (state) => [state.phaseId],
        requiresCity: () => false
    }
    const route: TrainRoute = {
        trainId: state.trainInventory.trains[0].id,
        start: { locationId: '0', nodeId: 'city' },
        paths: faces.flatMap((face, index) =>
            face.paths
                .filter(
                    (path) =>
                        path.endpoints.some(
                            (endpoint) =>
                                endpoint.kind === 'edge' && endpoint.edge === (index === 0 ? 0 : 3)
                        ) ||
                        (index > 0 &&
                            index < faces.length - 1 &&
                            path.endpoints.some(
                                (endpoint) => endpoint.kind === 'edge' && endpoint.edge === 0
                            ))
                )
                .map((path) => ({ locationId: String(index), pathId: path.id }))
        )
    }
    return { state, rules, route, running: new RouteEvaluation(state, rules) }
}
it('counts all visits and H borders differently, including trailing towns for + trains', () => {
    const faces = [
        city('yellow', [0], 20, 1),
        town('yellow', [[3, 0]], 10),
        city('green', [3, 0], 30, 2),
        town('yellow', [[3]], 10)
    ]
    for (const [distance, expected] of [
        [{ measure: 'hex-edges', maximum: 3 }, 3],
        [{ measure: 'cities-and-offboards', maximum: 2 }, 2],
        [{ measure: 'revenue-centers', maximum: 4 }, 4]
    ] as const) {
        const { running, route } = fixture(faces, distance)
        const result = running.evaluate('A', [route]).result!
        expect(result.revenue).toBe(70)
        expect(result.routes[0].distance).toBe(expected)
        expect(result.routes[0].visits).toHaveLength(4)
    }
    const { running, route } = fixture(faces)
    expect(running.evaluate('A', [route]).reason).toContain('distance limit')
})
it('requires continuous track, revenue endpoints and a company station', () => {
    const { running, route, state } = fixture([
        city('yellow', [0], 20, 1),
        track('yellow', [[3, 0]]),
        city('yellow', [3], 30, 1)
    ])
    expect(running.evaluate('A', [route]).result?.revenue).toBe(50)
    expect(
        running.evaluate('A', [{ ...route, paths: [route.paths[0], route.paths[2]] }]).reason
    ).toContain('disconnected')
    expect(running.evaluate('A', [{ ...route, paths: route.paths.slice(0, -1) }]).reason).toContain(
        'End the route'
    )
    state.stations = []
    expect(running.evaluate('A', [route]).reason).toContain('station')
})
it('allows a full rival city at an endpoint but not internally; reservations do not block', () => {
    const { running, route, state } = fixture([
        city('yellow', [0], 20, 1),
        city('yellow', [3, 0], 30, 1),
        city('yellow', [3], 20, 1)
    ])
    state.stations.push({
        id: 'rival',
        companyId: 'B',
        status: 'placed',
        position: { locationId: '1', nodeId: 'city', slot: 0 }
    })
    expect(running.evaluate('A', [route]).reason).toContain('blocked')
    expect(
        running.evaluate('A', [{ ...route, paths: route.paths.slice(0, 2) }]).result?.revenue
    ).toBe(50)
    state.stations.pop()
    state.stationReservations.push({ companyId: 'B', locationId: '1', nodeId: 'city' })
    expect(running.evaluate('A', [route]).result?.revenue).toBe(70)
})
it('rejects repeated train, track, revenue center and shared borders across distinct paths', () => {
    const { running, route, state } = fixture([
        city('yellow', [0], 20, 1),
        city('yellow', [3], 30, 1)
    ])
    expect(running.evaluate('A', [route, route]).reason).toContain('only once')
    expect(
        running.evaluate('A', [route, { ...route, trainId: state.trainInventory.trains[1].id }])
            .reason
    ).toContain('share track')
    expect(
        running.evaluate('A', [{ ...route, paths: [...route.paths, route.paths[1]] }]).reason
    ).toContain('reuse track')
    const parallel = fixture([
        city('yellow', [0], 20, 1),
        {
            color: 'green',
            labels: [],
            nodes: [
                {
                    id: 'city',
                    kind: 'city',
                    revenue: { kind: 'fixed', amount: 30 },
                    stationSlots: 1
                }
            ],
            paths: [
                {
                    id: 'a',
                    endpoints: [
                        { kind: 'edge', edge: 3 },
                        { kind: 'node', nodeId: 'city' }
                    ]
                },
                {
                    id: 'b',
                    endpoints: [
                        { kind: 'node', nodeId: 'city' },
                        { kind: 'edge', edge: 3 }
                    ]
                }
            ]
        }
    ])
    expect(
        parallel.running.network.trace(parallel.route.start, [
            { locationId: '0', pathId: 'edge-0' },
            { locationId: '1', pathId: 'a' },
            { locationId: '1', pathId: 'b' }
        ]).reason
    ).toContain('hex border')
})
it('does not connect crossing tracks or bypass impassable borders', () => {
    const { running, route } = fixture([
        city('yellow', [0], 20, 1),
        track('green', [
            [3, 0],
            [2, 5]
        ]),
        city('yellow', [3], 30, 1)
    ])
    expect(
        running.evaluate('A', [
            {
                ...route,
                paths: [route.paths[0], { locationId: '1', pathId: 'path-1' }, route.paths[2]]
            }
        ]).reason
    ).toContain('disconnected')
    const blocked = new RailwayMap({
        ...running.rules.map.definition,
        locations: running.rules.map.definition.locations.map((location) =>
            location.id === '0'
                ? { ...location, borders: [{ edge: 0, kind: 'impassable' }] }
                : location
        )
    })
    const f = fixture([
        city('yellow', [0], 20, 1),
        track('green', [
            [3, 0],
            [2, 5]
        ]),
        city('yellow', [3], 30, 1)
    ])
    expect(
        new RouteEvaluation(f.state, { ...f.rules, map: blocked }).evaluate('A', [f.route]).reason
    ).toContain('connected track')
})
it('uses explicit revenue stages, treats offboards as terminal and rejects unavailable train ownership', () => {
    const { running, route, state } = fixture([
        city('yellow', [0], 20, 1),
        offboard(
            [3, 0],
            staged([
                ['yellow', 30],
                ['brown', 60]
            ])
        ),
        city('yellow', [3], 20, 1)
    ])
    const short = { ...route, paths: route.paths.slice(0, 2) }
    expect(running.evaluate('A', [short]).result?.revenue).toBe(50)
    state.phaseId = 'brown'
    expect(running.evaluate('A', [short]).result?.revenue).toBe(80)
    expect(running.evaluate('A', [route]).reason).toContain('offboard')
    expect(running.evaluate('A', [{ ...short, trainId: 'unknown' }]).reason).toContain(
        'does not own'
    )
})
it('validates without mutating state and preserves a token in the middle', () => {
    const { running, state } = fixture([
        city('yellow', [0], 20, 1),
        city('yellow', [3, 0], 30, 1),
        city('yellow', [3], 20, 1)
    ])
    state.stations[0] = {
        id: 'home',
        companyId: 'A',
        status: 'placed',
        position: { locationId: '1', nodeId: 'city', slot: 0 }
    }
    const before = structuredClone(state)
    const route: TrainRoute = {
        trainId: state.trainInventory.trains[0].id,
        start: { locationId: '0', nodeId: 'city' },
        paths: [
            { locationId: '0', pathId: 'edge-0' },
            { locationId: '1', pathId: 'edge-3' },
            { locationId: '1', pathId: 'edge-0' },
            { locationId: '2', pathId: 'edge-3' }
        ]
    }
    expect(running.evaluate('A', [route]).result?.revenue).toBe(70)
    expect(state).toEqual(before)
})
it('allows distinct routes to pay the same station using different arms', () => {
    const { running, state } = fixture([
        city('yellow', [0], 20, 1),
        city('yellow', [3, 0], 30, 1),
        city('yellow', [3], 20, 1)
    ])
    state.stations[0] = {
        id: 'home',
        companyId: 'A',
        status: 'placed',
        position: { locationId: '1', nodeId: 'city', slot: 0 }
    }
    const routes: TrainRoute[] = [
        {
            trainId: state.trainInventory.trains[0].id,
            start: { locationId: '1', nodeId: 'city' },
            paths: [
                { locationId: '1', pathId: 'edge-3' },
                { locationId: '0', pathId: 'edge-0' }
            ]
        },
        {
            trainId: state.trainInventory.trains[1].id,
            start: { locationId: '1', nodeId: 'city' },
            paths: [
                { locationId: '1', pathId: 'edge-0' },
                { locationId: '2', pathId: 'edge-3' }
            ]
        }
    ]
    expect(running.evaluate('A', routes).result?.revenue).toBe(100)
})
it('rejects a repeated center even when its track segments are distinct', () => {
    const { running, state } = fixture([
        {
            color: 'green',
            labels: [],
            nodes: [
                {
                    id: 'city',
                    kind: 'city',
                    stationSlots: 1,
                    revenue: { kind: 'fixed', amount: 20 }
                },
                {
                    id: 'other',
                    kind: 'city',
                    stationSlots: 1,
                    revenue: { kind: 'fixed', amount: 30 }
                }
            ],
            paths: [
                {
                    id: 'a',
                    endpoints: [
                        { kind: 'node', nodeId: 'city' },
                        { kind: 'node', nodeId: 'other' }
                    ]
                },
                {
                    id: 'b',
                    endpoints: [
                        { kind: 'node', nodeId: 'other' },
                        { kind: 'node', nodeId: 'city' }
                    ]
                }
            ]
        }
    ])
    expect(
        running.evaluate('A', [
            {
                trainId: state.trainInventory.trains[0].id,
                start: { locationId: '0', nodeId: 'city' },
                paths: [
                    { locationId: '0', pathId: 'a' },
                    { locationId: '0', pathId: 'b' }
                ]
            }
        ]).reason
    ).toContain('revisit')
})

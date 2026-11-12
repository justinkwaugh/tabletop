import { readFile } from 'node:fs/promises'
import { beforeAll, expect, it } from 'vitest'
import { HexOrientation, assert } from '@tabletop/common'
import {
    RailwayMap,
    TileSet,
    TrainDepot,
    createCityTileFace as city,
    createTownTileFace as town,
    createTrackTileFace as track,
    createOffboardTileFace as offboard,
    createStagedTileRevenue as staged,
    type TileEdge,
    type TileFace,
    type TrackGauge,
    type TrainDistance,
    type TrainRunningState,
    type RouteRules
} from '@tabletop/18xx'
import { Autorouter, routeProblemKey } from './autorouter.js'
import { exhaustiveRevenue } from './testing/exhaustiveRevenue.js'

let router: Autorouter
beforeAll(async () => {
    const bytes = await readFile(new URL('../esm/solver.wasm', import.meta.url))
    router = await Autorouter.create(new Uint8Array(bytes).buffer)
})
function position(
    faces: TileFace[],
    distances: TrainDistance[],
    stopGroups: Readonly<Record<number, string>> = {},
    routeRules: Partial<RouteRules> = {}
) {
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
                buildable: true,
                ...(stopGroups[r] ? { stopGroup: stopGroups[r] } : {})
            }))
        }),
        tileSet,
        depot,
        requiresCity: (train) => train.distance.measure === 'cities-and-offboards',
        revenueStage: (state) => [state.phaseId],
        ...routeRules
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
it('visits one location of a stop group per route', () => {
    const faces = [
        city('yellow', [0], 20, 1),
        town('yellow', [[3, 0]], 10),
        town('yellow', [[3]], 40)
    ]
    const distances: TrainDistance[] = [{ measure: 'revenue-centers', maximum: 3 }]
    const ungrouped = position(faces, distances)
    expect(router.solve(ungrouped.state, ungrouped.rules, 'A').result.revenue).toBe(70)
    const grouped = position(faces, distances, { 1: 'Canada', 2: 'Canada' })
    const result = router.solve(grouped.state, grouped.rules, 'A')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(30)
})

it('stops once in each hex when the title allows one stop per hex', () => {
    const fixed = (amount: number) => ({ kind: 'fixed' as const, amount })
    const twoTowns: TileFace = {
        color: 'yellow',
        nodes: [
            { id: 'town-0', kind: 'town', revenue: fixed(10) },
            { id: 'town-1', kind: 'town', revenue: fixed(10) }
        ],
        paths: [
            {
                id: 'in',
                endpoints: [
                    { kind: 'edge', edge: 3 },
                    { kind: 'node', nodeId: 'town-0' }
                ]
            },
            {
                id: 'between',
                endpoints: [
                    { kind: 'node', nodeId: 'town-0' },
                    { kind: 'node', nodeId: 'town-1' }
                ]
            },
            {
                id: 'out',
                endpoints: [
                    { kind: 'node', nodeId: 'town-1' },
                    { kind: 'edge', edge: 0 }
                ]
            }
        ],
        labels: []
    }
    const faces = [city('yellow', [0], 20, 1), twoTowns, town('yellow', [[3]], 40)]
    const distances: TrainDistance[] = [{ measure: 'revenue-centers', maximum: 4 }]
    const free = position(faces, distances)
    expect(router.solve(free.state, free.rules, 'A').result.revenue).toBe(80)
    const limited = position(faces, distances, {}, { oneStopPerHex: true })
    const result = router.solve(limited.state, limited.rules, 'A')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(30)
})
it('finds routes earning the title’s hex and stop bonuses', () => {
    const { state, rules } = position(
        [city('yellow', [0], 20, 1), track('yellow', [[3, 0]]), city('yellow', [3], 30, 1)],
        [{ measure: 'revenue-centers', maximum: 2 }],
        {},
        {
            hexBonus: (_state, locationId) => (locationId === '1' ? 10 : 0),
            stopBonus: (_state, _train, _companyId, center) => (center.locationId === '2' ? 5 : 0)
        }
    )
    const result = router.solve(state, rules, 'A')
    expect(result.result.revenue).toBe(65)
    expect(result.result.routes[0].bonuses).toHaveLength(2)
})

it('scores express paying stops with route-wide bonuses', () => {
    const { state, rules } = position(
        [city('yellow', [0], 20, 1), city('yellow', [3, 0], 30, 1), city('yellow', [3], 40, 1)],
        [{ measure: 'revenue-centers', maximum: 3 }],
        {},
        {
            revenuePolicy: () => ({
                payingStopLimit: 2,
                requirePayingStation: true,
                connectionBonuses: [{ from: { '0': 0 }, to: { '2': 50 } }]
            })
        }
    )
    const result = router.solve(state, rules, 'A')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(110)
    expect(result.result.routes[0].visits).toHaveLength(3)
})

it.each([false, true])(
    'scores a fleet bonus once across compatible trains (same definition %s)',
    (sameDefinition) => {
        const { state, rules } = position(
            [city('yellow', [0], 20, 1), city('yellow', [3, 0], 30, 1), city('yellow', [3], 40, 1)],
            [
                { measure: 'revenue-centers', maximum: 2 },
                { measure: 'revenue-centers', maximum: 2 }
            ],
            {},
            {
                longestRouteBonusPerStop: () => 10
            }
        )
        if (sameDefinition) state.trainInventory.trains[1].definitionId = '0'
        state.stations[0].position = { locationId: '1', nodeId: 'city', slot: 0 }
        const result = router.solve(state, rules, 'A')
        expect(result.exhaustive).toBe(true)
        expect(result.result.revenue).toBe(140)
        expect(result.result.routes).toHaveLength(2)
        expect(result.result.revenue).toBe(exhaustiveRevenue(state, rules, 'A'))
        expect(new Set(result.result.routes.map((route) => route.trainId)).size).toBe(2)
    }
)

it.each([false, true])('excludes trains barred by title rules (custom scoring %s)', (custom) => {
    const { state, rules } = position(
        [city('yellow', [0], 20, 1), city('yellow', [3], 30, 1)],
        [{ measure: 'revenue-centers', maximum: 2 }],
        {},
        {
            canRunTrain: () => false,
            ...(custom ? { revenuePolicy: () => ({ payingStopLimit: 2 }) } : {})
        }
    )
    const before = structuredClone(state)
    expect(router.solve(state, rules, 'A').result.routes).toEqual([])
    expect(state).toEqual(before)
})

it.each([false, true])(
    'returns a legal partial result when the scoring search runs out of time (mixed %s)',
    (mixed) => {
        const { state, rules } = position(
            [city('yellow', [0], 20, 1), city('yellow', [3], 30, 1)],
            mixed
                ? [
                      { measure: 'revenue-centers', maximum: 2 },
                      { measure: 'revenue-centers', maximum: 3 }
                  ]
                : [{ measure: 'revenue-centers', maximum: 2 }],
            {},
            { revenuePolicy: () => ({ payingStopLimit: 2 }) }
        )
        const result = router.solve(state, rules, 'A', { timeLimitMs: 0.000001 })
        expect(result.exhaustive).toBe(false)
        expect(result.result.routes).toEqual([])
    }
)

it.each([10, 40])('streams mixed profiles with a longest-route bonus of %s', (bonus) => {
    for (const capacities of [
        [2, 3],
        [3, 2]
    ]) {
        const { state, rules } = position(
            [city('yellow', [0], 20, 1), city('yellow', [3, 0], 30, 1), city('yellow', [3], 40, 1)],
            capacities.map((maximum) => ({ measure: 'revenue-centers', maximum })),
            {},
            { longestRouteBonusPerStop: () => bonus }
        )
        state.stations[0].position = { locationId: '1', nodeId: 'city', slot: 0 }
        const result = router.solve(state, rules, 'A')
        expect(result.exhaustive).toBe(true)
        expect(result.result.revenue).toBe(exhaustiveRevenue(state, rules, 'A'))
        expect(result.result.revenue).toBe(bonus === 10 ? 140 : 210)
    }
})

it.each([
    [{ maximum: 2, extraTowns: 3 }, 100],
    [{ maximum: 3, extraTowns: 1 }, 90],
    [{ maximum: 3, extraTowns: 2 }, 110]
])('limits an N+s train to N stops other than towns (%o)', (limits, expected) => {
    const { state, rules } = position(
        [
            city('yellow', [0], 20, 1),
            town('yellow', [[3, 0]], 10),
            city('yellow', [3, 0], 30, 1),
            town('yellow', [[3, 0]], 10),
            city('yellow', [3, 0], 40, 1),
            town('yellow', [[3]], 10)
        ],
        [{ measure: 'revenue-centers', ...limits }]
    )
    state.stations[0].position = { locationId: '2', nodeId: 'city', slot: 0 }
    const result = router.solve(state, rules, 'A')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(expected)
    expect(result.result.revenue).toBe(exhaustiveRevenue(state, rules, 'A'))
})

it.each([
    ['1', 100],
    ['2', 140]
])('pays a company’s end-only destination at %s only where a route ends', (to, expected) => {
    const { state, rules } = position(
        [city('yellow', [0], 20, 1), city('yellow', [3, 0], 30, 1), city('yellow', [3], 40, 1)],
        [{ measure: 'revenue-centers', maximum: 3 }],
        {},
        {
            revenuePolicy: (_train, state, companyId) =>
                companyId === 'A' && state.phaseId === 'yellow'
                    ? {
                          connectionBonuses: [
                              { from: { '0': 50 }, to: { [to]: 0 }, destinationAtEnd: true }
                          ]
                      }
                    : {}
        }
    )
    const result = router.solve(state, rules, 'A')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(expected)
    expect(result.result.revenue).toBe(exhaustiveRevenue(state, rules, 'A'))
})

it('extends a route through a blocked city to earn an interconnection', () => {
    const { state, rules } = position(
        [
            city('yellow', [0], 20, 1),
            city('yellow', [3, 0], 30, 1),
            city('yellow', [3, 0], 40, 1),
            city('yellow', [3], 60, 1)
        ],
        [{ measure: 'revenue-centers', maximum: 2 }],
        {},
        { revenuePolicy: () => ({ interconnections: [{ from: ['0'], to: ['3'], amount: 50 }] }) }
    )
    state.companies.push({ id: 'B', name: 'B', kind: 'major', shareCount: 10 })
    state.stations.push({
        id: 'rival',
        companyId: 'B',
        status: 'placed',
        position: { locationId: '2', nodeId: 'city', slot: 0 }
    })
    const result = router.solve(state, rules, 'A')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(100)
    expect(result.result.revenue).toBe(exhaustiveRevenue(state, rules, 'A'))
    const [route] = result.result.routes
    expect(route.visits).toHaveLength(2)
    expect(route.extension?.map((path) => path.locationId)).toEqual(['1', '2', '2', '3'])
    expect(route.bonuses).toEqual([{ locationId: '3', amount: 50 }])
})

it.each([
    [undefined, 270],
    [1, 180]
])(
    'hangs an extension off either end and keeps its track from other trains (paying %s)',
    (payingStopLimit, expected) => {
        const { state, rules } = position(
            [
                city('yellow', [0], 10, 1),
                city('yellow', [3, 0], 20, 1),
                city('yellow', [3, 0], 30, 1),
                city('yellow', [3, 0], 40, 1),
                city('yellow', [3], 50, 1)
            ],
            [
                { measure: 'revenue-centers', maximum: 2 },
                { measure: 'revenue-centers', maximum: 3 }
            ],
            {},
            {
                revenuePolicy: () => ({
                    ...(payingStopLimit ? { payingStopLimit } : {}),
                    interconnections: [
                        { from: ['2'], to: ['0'], amount: 100 },
                        { from: ['3'], to: ['0'], amount: 120 }
                    ]
                })
            }
        )
        state.stations[0].position = { locationId: '2', nodeId: 'city', slot: 0 }
        const result = router.solve(state, rules, 'A')
        expect(result.exhaustive).toBe(true)
        expect(result.result.revenue).toBe(expected)
        expect(result.result.revenue).toBe(exhaustiveRevenue(state, rules, 'A'))
        const extended = result.result.routes.find((route) => route.extension)
        expect(extended?.start.locationId).toBe('2')
        expect(extended?.extension?.at(-1)?.locationId).toBe('0')
    }
)
it('builds the solver with a 64 MiB memory maximum', async () => {
    const bytes = await readFile(new URL('../esm/solver.wasm', import.meta.url))
    const { instance } = await WebAssembly.instantiate(bytes, {
        clock: { now: () => performance.now() }
    })
    const memory = instance.exports.memory
    assert(memory instanceof WebAssembly.Memory, 'The solver exports its memory')
    const page = 64 * 1024
    memory.grow(64 * 16 - memory.buffer.byteLength / page)
    expect(memory.buffer.byteLength).toBe(64 * 2 ** 20)
    expect(() => memory.grow(1)).toThrow(RangeError)
})
it('runs a required route between its stops, the rest of the fleet beside it', () => {
    // A line: home city, a $10 town, a $30 city, then a $90 town past it.
    const { state, rules } = position(
        [
            city('yellow', [0], 20, 1),
            town('yellow', [[3, 0]], 10),
            city('yellow', [3, 0], 30, 1),
            town('yellow', [[3]], 90)
        ],
        [
            { measure: 'revenue-centers', maximum: 4 },
            { measure: 'revenue-centers', maximum: 2 }
        ],
        {},
        {
            requiredRouteEnds: () => [
                { locationId: '0', nodeId: 'city' },
                { locationId: '2', nodeId: 'city' }
            ]
        }
    )
    const free = router.solve(state, { ...rules, requiredRouteEnds: undefined }, 'A')
    expect(free.result.revenue).toBe(150)
    const required = router.solve(state, rules, 'A')
    expect(required.exhaustive).toBe(true)
    // The whole line would earn more, but one train must stop at the $30 city.
    expect(required.result.routes.map((route) => route.revenue).sort((a, b) => b - a)).toEqual([60])
    expect(required.result.routes[0].visits.at(-1)?.locationId).toBe('2')
})
it('keys a required run apart from an ordinary run of the same network', () => {
    const ends = [
        { locationId: '0', nodeId: 'city' },
        { locationId: '1', nodeId: 'city' }
    ]
    const { state, rules } = position(
        [city('yellow', [0], 20, 1), city('yellow', [3], 30, 1)],
        [{ measure: 'revenue-centers', maximum: 2 }]
    )
    expect(routeProblemKey(state, rules, 'A')).not.toBe(
        routeProblemKey(state, { ...rules, requiredRouteEnds: () => ends }, 'A')
    )
})
it('limits a train with an extra town to its maximum of other stops', () => {
    const faces = [
        city('yellow', [0], 20, 1),
        town('yellow', [[3, 0]], 10),
        city('yellow', [3, 0], 30, 1),
        city('yellow', [3, 0], 40, 1),
        town('yellow', [[3]], 10)
    ]
    // Two stops and a town: the 20, the town, the 30; or skip the town's extra to reach 40.
    const { state, rules } = position(faces, [
        { measure: 'revenue-centers', maximum: 2, extraTowns: 1 }
    ])
    const result = router.solve(state, rules, 'A')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(exhaustiveRevenue(state, rules, 'A'))
    expect(result.result.revenue).toBe(60)
})
it('adds the best value of the route’s other stops where a title asks', () => {
    const faces = [
        city('yellow', [0], 20, 1),
        city('yellow', [3, 0], 50, 1),
        offboard([3], staged([['yellow', 0]]))
    ]
    const { state, rules } = position(
        faces,
        [{ measure: 'revenue-centers', maximum: 3 }],
        {},
        {
            bestStopBonuses: () => [{ locationIds: ['2'] }]
        }
    )
    const result = router.solve(state, rules, 'A')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(120)
    expect(result.result.revenue).toBe(exhaustiveRevenue(state, rules, 'A'))
})

type Exit = readonly [TileEdge, TrackGauge | undefined]
function gaugedStop(
    kind: 'city' | 'town' | 'offboard' | 'junction',
    revenue: number,
    exits: readonly Exit[]
): TileFace {
    const nodeId = kind === 'city' ? 'city' : kind
    return {
        color: 'yellow',
        labels: [],
        nodes: [
            kind === 'junction'
                ? { id: nodeId, kind }
                : kind === 'city'
                  ? {
                        id: nodeId,
                        kind,
                        stationSlots: 2,
                        revenue: { kind: 'fixed', amount: revenue }
                    }
                  : { id: nodeId, kind, revenue: { kind: 'fixed', amount: revenue } }
        ],
        paths: exits.map(([edge, gauge], index) => ({
            id: `exit-${index}`,
            endpoints: [
                { kind: 'edge', edge },
                { kind: 'node', nodeId }
            ],
            ...(gauge ? { gauge } : {})
        }))
    }
}
function parallelLines(gauges: readonly (TrackGauge | undefined)[]): TileFace {
    return {
        color: 'yellow',
        labels: [],
        nodes: [],
        paths: gauges.map((gauge, index) => ({
            id: `line-${index}`,
            endpoints: [
                { kind: 'edge', edge: 3 },
                { kind: 'edge', edge: 0 }
            ],
            ...(gauge ? { gauge } : {})
        }))
    }
}
const OrdinaryHex = (maximum: number): TrainDistance => ({
    measure: 'hex-edges',
    maximum,
    gaugeWeights: { standard: 1, narrow: 2 }
})
const ReverseHex = (maximum: number): TrainDistance => ({
    measure: 'hex-edges',
    maximum,
    gaugeWeights: { standard: 2, narrow: 1 }
})
it('changes gauge only at stops and weighs each stretch by its gauge', () => {
    const through = position(
        [
            gaugedStop('city', 20, [[0, 'narrow']]),
            parallelLines(['dual']),
            gaugedStop('city', 50, [[3, undefined]])
        ],
        [OrdinaryHex(8)]
    )
    expect(router.solve(through.state, through.rules, 'A').result.revenue).toBe(0)
    const atTown = position(
        [
            gaugedStop('city', 20, [[0, 'narrow']]),
            gaugedStop('town', 10, [
                [3, 'dual'],
                [0, 'dual']
            ]),
            gaugedStop('city', 50, [
                [3, undefined],
                [0, undefined]
            ]),
            gaugedStop('town', 10, [[3, undefined]])
        ],
        [OrdinaryHex(3), ReverseHex(3)]
    )
    const result = router.solve(atTown.state, atTown.rules, 'A')
    expect(result.result.revenue).toBe(exhaustiveRevenue(atTown.state, atTown.rules, 'A'))
    expect(result.result.revenue).toBe(80)
    expect(result.result.routes[0].distance).toBe(3)
})
it('needs the cities and towns a title asks of a route, not counting offboards', () => {
    const faces = [
        gaugedStop('city', 20, [[0, undefined]]),
        gaugedStop('offboard', 40, [[3, undefined]])
    ]
    const without = position(faces, [OrdinaryHex(2)])
    expect(router.solve(without.state, without.rules, 'A').result.revenue).toBe(60)
    const required = position(faces, [OrdinaryHex(2)], {}, { minimumCitiesAndTowns: 2 })
    expect(router.solve(required.state, required.rules, 'A').result.revenue).toBe(0)
    expect(exhaustiveRevenue(required.state, required.rules, 'A')).toBe(0)
    const withTown = position(
        [
            faces[0],
            gaugedStop('town', 10, [
                [3, undefined],
                [0, undefined]
            ]),
            faces[1]
        ],
        [OrdinaryHex(2)],
        {},
        { minimumCitiesAndTowns: 2 }
    )
    expect(router.solve(withTown.state, withTown.rules, 'A').result.revenue).toBe(70)
})
it('matches exhaustive route enumeration on random mixed-gauge lines', () => {
    let seed = 1849
    const random = () => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
    const gauges = [undefined, 'narrow', 'dual'] as const
    const exits = (edge: TileEdge): Exit[] =>
        Array.from({ length: 1 + Math.floor(random() * 2) }, () => [edge, pick(gauges)])
    for (let trial = 0; trial < 60; trial++) {
        const middle = Array.from({ length: 2 + Math.floor(random() * 3) }, (): TileFace => {
            const kind = pick(['line', 'line', 'city', 'town', 'junction'] as const)
            if (kind === 'line')
                return parallelLines(
                    Array.from({ length: 1 + Math.floor(random() * 2) }, () => pick(gauges))
                )
            return gaugedStop(kind, 10 * (1 + Math.floor(random() * 5)), [...exits(3), ...exits(0)])
        })
        const faces = [
            gaugedStop('city', 20, exits(0)),
            ...middle,
            gaugedStop(pick(['city', 'town', 'offboard'] as const), 40, exits(3))
        ]
        const { state, rules } = position(
            faces,
            [OrdinaryHex(2 + Math.floor(random() * 5)), ReverseHex(2 + Math.floor(random() * 5))],
            {},
            random() < 0.5 ? { minimumCitiesAndTowns: 2 } : {}
        )
        const result = router.solve(state, rules, 'A')
        expect(result.exhaustive).toBe(true)
        expect(result.result.revenue, JSON.stringify(faces)).toBe(
            exhaustiveRevenue(state, rules, 'A')
        )
    }
})

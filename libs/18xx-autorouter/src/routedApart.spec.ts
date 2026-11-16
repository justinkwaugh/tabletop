import { readFile } from 'node:fs/promises'
import { beforeAll, expect, it } from 'vitest'
import {
    createCityTileFace as city,
    createTownTileFace as town,
    usesStationAt,
    type RouteRules,
    type TileEdge,
    type TileFace,
    type TrainDistance
} from '@tabletop/18xx'
import { Autorouter } from './autorouter.js'
import { linePosition as position } from './testing/linePosition.js'

let router: Autorouter
beforeAll(async () => {
    const bytes = await readFile(new URL('../esm/solver.wasm', import.meta.url))
    router = await Autorouter.create(new Uint8Array(bytes).buffer)
})

const stops = (maximum: number): TrainDistance => ({ measure: 'revenue-centers', maximum })
const stationRun: TrainDistance = {
    measure: 'revenue-centers',
    maximum: 1,
    extraTowns: 1,
    stationRun: true
}

function secondStation(state: ReturnType<typeof position>['state'], locationId: string): void {
    state.stations.push({
        id: `station-${locationId}`,
        companyId: 'A',
        status: 'placed',
        position: { locationId, nodeId: 'city', slot: 0 }
    })
}

function terminusCity(edges: readonly TileEdge[], revenue: number): TileFace {
    const face = city('gray', edges, revenue, 2)
    return { ...face, paths: face.paths.map((path) => ({ ...path, terminus: true as const })) }
}

it('ends a route where it reaches a terminus and starts one there freely', () => {
    const faces = [city('yellow', [0], 20, 1), terminusCity([3, 0], 30), city('yellow', [3], 40, 1)]
    const fromOutside = position(faces, [stops(3)])
    expect(router.solve(fromOutside.state, fromOutside.rules, 'A').result.revenue).toBe(50)
    const fromTerminus = position(faces, [stops(3)])
    fromTerminus.state.stations[0].position.locationId = '1'
    expect(router.solve(fromTerminus.state, fromTerminus.rules, 'A').result.revenue).toBe(70)
})

it('runs on across a link of terminus track only from a station on its near side', () => {
    const middle = city('gray', [3, 0], 30, 2)
    const link = (edge: TileEdge): TileFace => ({
        ...middle,
        paths: middle.paths.map((path) =>
            path.endpoints.some((end) => end.kind === 'edge' && end.edge === edge)
                ? { ...path, terminus: true as const }
                : path
        )
    })
    const towardLink = [city('yellow', [0], 20, 1), link(0), terminusCity([3], 40)]
    const nearStation = position(towardLink, [stops(3)])
    expect(router.solve(nearStation.state, nearStation.rules, 'A').result.revenue).toBe(90)
    const farStation = position(towardLink, [stops(3)])
    farStation.state.stations[0].position.locationId = '2'
    expect(router.solve(farStation.state, farStation.rules, 'A').result.revenue).toBe(70)
    const awayFromLink = [terminusCity([0], 40), link(3), city('yellow', [3], 20, 1)]
    const lastStation = position(awayFromLink, [stops(3)])
    lastStation.state.stations[0].position.locationId = '2'
    expect(router.solve(lastStation.state, lastStation.rules, 'A').result.revenue).toBe(90)
})

it('runs two trains across one hex side on its two lanes', () => {
    const home: TileFace = {
        ...city('yellow', [], 20, 1),
        paths: [0, 1].map((lane) => ({
            id: `lane-${lane}`,
            endpoints: [
                lane ? { kind: 'edge', edge: 0, lane } : { kind: 'edge', edge: 0 },
                { kind: 'node', nodeId: 'city' }
            ]
        }))
    }
    const twoCities: TileFace = {
        color: 'yellow',
        labels: [],
        nodes: [30, 40].map((amount, index) => ({
            id: `city-${index}`,
            kind: 'city',
            stationSlots: 1,
            revenue: { kind: 'fixed', amount }
        })),
        paths: [0, 1].map((lane) => ({
            id: `lane-${lane}`,
            endpoints: [
                lane ? { kind: 'edge', edge: 3, lane } : { kind: 'edge', edge: 3 },
                { kind: 'node', nodeId: `city-${lane}` }
            ]
        }))
    }
    const { state, rules } = position([home, twoCities], [stops(2), stops(2)])
    const { result, exhaustive } = router.solve(state, rules, 'A')
    expect(exhaustive).toBe(true)
    expect(result.routes).toHaveLength(2)
    expect(result.revenue).toBe(110)
})

it('passes an uncounted stop without using the train’s distance', () => {
    const channel = city('yellow', [3, 0], 0, 1)
    const uncounted: TileFace = {
        ...channel,
        nodes: channel.nodes.map((node) => ({ ...node, uncounted: true as const }))
    }
    const { state, rules } = position(
        [city('yellow', [0], 20, 1), uncounted, city('yellow', [3], 40, 1)],
        [stops(2)]
    )
    const { result } = router.solve(state, rules, 'A')
    expect(result.revenue).toBe(60)
    expect(result.routes[0].visits).toHaveLength(3)
    expect(result.routes[0].distance).toBe(2)
})

it('runs a station-run train at its station alone, on no track', () => {
    const { state, rules } = position([city('yellow', [], 30, 1)], [stationRun])
    const { result, exhaustive } = router.solve(state, rules, 'A')
    expect(exhaustive).toBe(true)
    expect(result.revenue).toBe(30)
    expect(result.routes).toEqual([
        expect.objectContaining({ trainId: '0', paths: [], revenue: 30 })
    ])
})

it('runs one station-run train from each station, with a town where one is in reach', () => {
    const faces = [city('yellow', [0], 30, 1), town('yellow', [[3]], 10)]
    const { state, rules } = position(faces, [stationRun, stationRun])
    const { result } = router.solve(state, rules, 'A')
    expect(result.routes).toHaveLength(1)
    expect(result.revenue).toBe(40)
})

it('weighs a station run to a town against the track another train needs', () => {
    const { state, rules } = position(
        [city('yellow', [0], 30, 1), town('yellow', [[3, 0]], 10), city('yellow', [3], 50, 1)],
        [stationRun, { measure: 'cities-and-offboards', maximum: 2 }]
    )
    const { result, exhaustive } = router.solve(state, rules, 'A')
    expect(exhaustive).toBe(true)
    expect(result.revenue).toBe(120)
    expect(result.routes.find((route) => route.trainId === '0')?.paths).toEqual([])
})

it('routes a train that stops only at its stations over track another train uses', () => {
    const express: Partial<RouteRules> = {
        stopsAt: (state, companyId, center, train) =>
            train.id !== '0' || usesStationAt(state, companyId, center.locationId, center.nodeId),
        stopRevenue: (_state, _companyId, _center, printed, train) =>
            train.id === '0' ? printed * 2 : printed
    }
    const { state, rules } = position(
        [city('yellow', [0], 20, 2), city('yellow', [3, 0], 30, 2), city('yellow', [3], 40, 2)],
        [
            { distance: { measure: 'revenue-centers', maximum: 'unlimited' }, sharesTrack: true },
            stops(3)
        ],
        {},
        express
    )
    secondStation(state, '2')
    const { result, exhaustive } = router.solve(state, rules, 'A')
    expect(exhaustive).toBe(true)
    expect(result.revenue).toBe(120 + 90)
    const [expressRoute] = result.routes.filter((route) => route.trainId === '0')
    expect(expressRoute.visits).toHaveLength(3)
    expect(expressRoute.payments).toHaveLength(2)
})

it('leaves a station-only train idle where it reaches no second station', () => {
    const { state, rules } = position(
        [city('yellow', [0], 20, 2), city('yellow', [3], 30, 2)],
        [{ distance: { measure: 'revenue-centers', maximum: 'unlimited' }, sharesTrack: true }],
        {},
        {
            stopsAt: (state, companyId, center) =>
                usesStationAt(state, companyId, center.locationId, center.nodeId)
        }
    )
    expect(router.solve(state, rules, 'A').result.routes).toEqual([])
})

it('attaches rolling stock to a train for the run it improves', () => {
    const { state, rules } = position(
        [
            city('yellow', [0], 20, 1),
            town('yellow', [[3, 0]], 10),
            city('yellow', [3, 0], 30, 1),
            town('yellow', [[3]], 10)
        ],
        [stops(2), { distance: stops(1), attachment: true }],
        {},
        {
            attachedDefinition: (_state, train) => ({
                ...train,
                distance: { measure: 'cities-and-offboards', maximum: 2 }
            })
        }
    )
    const { result } = router.solve(state, rules, 'A')
    expect(result.revenue).toBe(70)
    expect(result.routes).toEqual([expect.objectContaining({ trainId: '0', attachmentIds: ['1'] })])
})

it('gives a once-a-run bonus to one route though two earn it', () => {
    const lanes = (edge: TileEdge, revenue: number): TileFace => ({
        ...city('yellow', [], revenue, 1),
        paths: [0, 1].map((lane) => ({
            id: `lane-${lane}`,
            endpoints: [
                lane ? { kind: 'edge', edge, lane } : { kind: 'edge', edge },
                { kind: 'node', nodeId: 'city' }
            ]
        }))
    })
    const { state, rules } = position(
        [lanes(0, 20), lanes(3, 30)],
        [stops(2), stops(2)],
        {},
        {
            revenuePolicy: () => ({
                connectionBonuses: [
                    { from: { '0': 0 }, to: { '1': 30 }, oncePerRun: true, sourceId: 'destination' }
                ]
            })
        }
    )
    const { result } = router.solve(state, rules, 'A')
    expect(result.routes).toHaveLength(2)
    expect(result.revenue).toBe(50 + 50 + 30)
})

it('reports the subsidy a title pays for the run it found', () => {
    const { state, rules } = position(
        [city('yellow', [0], 20, 1), city('yellow', [3], 40, 1)],
        [stops(2)],
        {},
        { runSubsidy: (_state, _companyId, routes) => (routes.length ? 30 : 0) }
    )
    const { result } = router.solve(state, rules, 'A')
    expect(result.revenue).toBe(60)
    expect(result.subsidy).toBe(30)
})

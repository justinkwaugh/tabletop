import { describe, expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import {
    createCityTileFace as city,
    createOffboardTileFace as offboard,
    createTownTileFace as town,
    createTrackTileFace as track
} from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import type { TileFace, TrackGauge } from '../tiles/tile.js'
import { TrainDepot } from '../trains/trainDepot.js'
import type { TrainDistance } from '../trains/train.js'
import { RouteEvaluation, type RouteRules } from './routeEvaluation.js'
import type { RoutePath, TrainRunningState } from './route.js'

function gauged(
    face: TileFace,
    gauge: TrackGauge | Readonly<Record<string, TrackGauge>>
): TileFace {
    return {
        ...face,
        paths: face.paths.map((path) => {
            const pathGauge = typeof gauge === 'string' ? gauge : gauge[path.id]
            return pathGauge ? { ...path, gauge: pathGauge } : path
        })
    }
}

const Ordinary: TrainDistance = {
    measure: 'hex-edges',
    maximum: 8,
    gaugeWeights: { standard: 1, narrow: 2 }
}
const Reverse: TrainDistance = {
    measure: 'hex-edges',
    maximum: 6,
    gaugeWeights: { standard: 2, narrow: 1 }
}
const Electric: TrainDistance = {
    measure: 'hex-edges',
    maximum: 'unlimited',
    standardGaugeOnly: true
}

// A column of hexes, each joined to the next by its edge 0 and the next one's edge 3; the company
// is at the first hex's city.
function column(faces: readonly TileFace[], rules: Partial<RouteRules> = {}) {
    const tileSet = new TileSet({ id: 'empty', entries: [] }, [])
    const depot = new TrainDepot({
        id: 'trains',
        trains: [
            { id: 'ordinary', name: '8H', price: 0, distance: Ordinary },
            { id: 'reverse', name: 'R6H', price: 0, distance: Reverse },
            { id: 'electric', name: 'E', price: 0, distance: Electric }
        ],
        supply: []
    })
    const state: TrainRunningState = {
        bank: {},
        companies: [{ id: 'A', kind: 'major', shareCount: 10 }],
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
            nextTrainNumber: 1,
            trains: ['ordinary', 'reverse', 'electric'].map((id) => ({
                id,
                definitionId: id,
                status: 'owned',
                owner: { kind: 'company', companyId: 'A' }
            }))
        },
        phaseId: 'yellow',
        routeStep: { companyId: 'A' }
    }
    const evaluation = new RouteEvaluation(state, {
        map: new RailwayMap({
            id: 'gauges',
            name: 'Gauges',
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
        revenueStage: (state) => [state.phaseId],
        requiresCity: () => false,
        ...rules
    })
    // The route along the column from the first hex to the last, by the paths at edges 0 and 3.
    const paths: RoutePath[] = faces.flatMap((face, index) =>
        face.paths
            .filter((path) =>
                path.endpoints.some(
                    (end) =>
                        end.kind === 'edge' &&
                        ((index > 0 && end.edge === 3) ||
                            (index < faces.length - 1 && end.edge === 0))
                )
            )
            .map((path) => ({ locationId: String(index), pathId: path.id }))
    )
    const run = (trainId: string) =>
        evaluation.evaluateRoute('A', {
            trainId,
            start: { locationId: '0', nodeId: 'city' },
            paths
        })
    return { evaluation, run }
}

describe('route distance by gauge', () => {
    it('counts a standard line as the train weighs standard track (1849 §10.5.1)', () => {
        const { run } = column([
            city('yellow', [0], 40, 1),
            track('yellow', [[3, 0]]),
            city('yellow', [3], 20, 1)
        ])
        expect(run('ordinary').result?.distance).toBe(2)
        expect(run('reverse').result?.distance).toBe(4)
    })

    it('counts a narrow line as the train weighs narrow track', () => {
        const { run } = column([
            gauged(city('yellow', [0], 40, 1), 'narrow'),
            gauged(city('yellow', [3], 20, 1), 'narrow')
        ])
        expect(run('ordinary').result?.distance).toBe(2)
        expect(run('reverse').result?.distance).toBe(1)
    })

    it('counts track dual from stop to stop one a hex for every train', () => {
        const { run } = column([
            gauged(city('yellow', [0], 40, 1), 'narrow'),
            gauged(city('green', [3, 0], 30, 2), { 'edge-3': 'narrow', 'edge-0': 'dual' }),
            gauged(city('yellow', [3], 20, 1), 'dual')
        ])
        expect(run('ordinary').result?.distance).toBe(3)
        expect(run('reverse').result?.distance).toBe(2)
    })

    it('counts dual track mixed with one gauge as that gauge throughout', () => {
        const { run } = column([
            gauged(city('yellow', [0], 40, 1), 'dual'),
            gauged(track('yellow', [[3, 0]]), 'dual'),
            track('yellow', [[3, 0]]),
            city('yellow', [3], 20, 1)
        ])
        expect(run('ordinary').result?.distance).toBe(3)
        expect(run('reverse').result?.distance).toBe(6)
    })

    it('counts every hex side one for a hex train without gauge weights', () => {
        const { evaluation } = column([
            gauged(city('yellow', [0], 40, 1), 'narrow'),
            gauged(city('yellow', [3], 20, 1), 'narrow')
        ])
        const trace = evaluation.network.trace({ locationId: '0', nodeId: 'city' }, [
            { locationId: '0', pathId: 'edge-0' },
            { locationId: '1', pathId: 'edge-3' }
        ]).trace
        expect(trace?.crossings).toBe(1)
        expect(trace?.stretches).toEqual([{ gauge: 'narrow', crossings: 1 }])
    })
})

describe('a train kept to standard gauge (1849 §14.3)', () => {
    it('runs standard and dual track but never narrow', () => {
        const standard = column([
            city('yellow', [0], 40, 1),
            track('yellow', [[3, 0]]),
            city('yellow', [3], 20, 1)
        ])
        expect(standard.run('electric').result?.revenue).toBe(60)
        const dual = column([
            gauged(city('yellow', [0], 40, 1), 'dual'),
            gauged(city('yellow', [3], 20, 1), 'dual')
        ])
        expect(dual.run('electric').result?.revenue).toBe(60)
        const narrow = column([
            gauged(city('yellow', [0], 40, 1), 'narrow'),
            gauged(city('yellow', [3], 20, 1), 'narrow')
        ])
        expect(narrow.run('electric').reason).toBe('The E train cannot run on narrow gauge.')
        expect(narrow.run('ordinary').result?.revenue).toBe(60)
    })
})

describe('routes across gauges', () => {
    it('changes gauge only at a town or city', () => {
        const through = column([
            gauged(city('yellow', [0], 40, 1), 'narrow'),
            gauged(track('yellow', [[3, 0]]), 'dual'),
            city('yellow', [3], 20, 1)
        ])
        expect(through.run('ordinary').reason).toBe(
            'A route may change gauge only at a town or city.'
        )
        const atTown = column([
            gauged(city('yellow', [0], 40, 1), 'narrow'),
            gauged(town('yellow', [[3, 0]], 10), 'dual'),
            city('yellow', [3], 20, 1)
        ])
        expect(atTown.run('ordinary').result?.revenue).toBe(70)
        expect(atTown.run('ordinary').result?.distance).toBe(3)
    })

    it('walks only onto track a route could run', () => {
        const faces = [
            gauged(city('yellow', [0], 40, 1), 'narrow'),
            gauged(track('yellow', [[3, 0]]), 'dual'),
            city('yellow', [3], 20, 1)
        ]
        const { evaluation } = column(faces)
        const stops: string[] = []
        evaluation.network.walk({ locationId: '0', nodeId: 'city' }, {}, (walk, atStop) => {
            if (atStop) stops.push(walk.visits.at(-1)!.locationId)
            return true
        })
        expect(stops).toEqual([])
        expect(
            evaluation.network.extensions({ locationId: '0', nodeId: 'city' }, [
                { locationId: '0', pathId: 'edge-0' },
                { locationId: '1', pathId: 'path-0' }
            ])
        ).toEqual([])
    })
})

describe('cities and towns a route must visit', () => {
    const port = offboard([3], { kind: 'fixed', amount: 30 })

    it('does not count an offboard toward them', () => {
        const rules = { minimumCitiesAndTowns: 2 }
        expect(column([city('yellow', [0], 40, 1), port], rules).run('ordinary').reason).toBe(
            'A route must visit at least 2 cities or towns.'
        )
        expect(column([city('yellow', [0], 40, 1), port]).run('ordinary').result?.revenue).toBe(70)
        expect(
            column([city('yellow', [0], 40, 1), town('yellow', [[3, 0]], 10), port], rules).run(
                'ordinary'
            ).result?.revenue
        ).toBe(80)
    })
})

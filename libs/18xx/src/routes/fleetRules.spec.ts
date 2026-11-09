import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { TileSet } from '../tiles/inventory.js'
import { createCityTileFace as city, createTownTileFace as town } from '../tiles/faces.js'
import type { TileFace } from '../tiles/tile.js'
import { TrainDepot } from '../trains/trainDepot.js'
import { RouteEvaluation, type RouteRules } from './routeEvaluation.js'
import type { FleetRules } from './fleetRules.js'
import type { TrainRunningState, TrainRoute } from './route.js'
import { applyTrainRun } from './runTrains.js'

// A line of hexes: home city, a town, another city.
const faces: TileFace[] = [
    city('yellow', [0], 20, 1),
    town('yellow', [[3, 0]], 10),
    city('yellow', [3], 30, 1)
]
const fullRoutePaths = [
    { locationId: '0', pathId: 'edge-0' },
    { locationId: '1', pathId: 'town-edge-3' },
    { locationId: '1', pathId: 'town-edge-0' },
    { locationId: '2', pathId: 'edge-3' }
]

function position(rules: Partial<RouteRules> = {}) {
    const map = new RailwayMap({
        id: 'line',
        name: 'Line',
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
        trains: [
            { id: '3', name: '3', price: 100, distance: { measure: 'revenue-centers', maximum: 3 } }
        ],
        supply: [{ definitionId: '3', count: 2 }]
    })
    const state: TrainRunningState = {
        bank: {},
        companies: [{ id: 'A', kind: 'major', shareCount: 10 }],
        cash: [
            { owner: { kind: 'bank' }, amount: 1000 },
            { owner: { kind: 'company', companyId: 'A' }, amount: 50 }
        ],
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
        const train = depot.nextTrain(state.trainInventory, '3')!
        depot.purchase(state.trainInventory, train.id, train.definitionId, {
            kind: 'company',
            companyId: 'A'
        })
    }
    const routeRules: RouteRules = {
        map,
        tileSet,
        depot,
        revenueStage: (state) => [state.phaseId],
        requiresCity: () => false,
        ...rules
    }
    const [first, second] = state.trainInventory.trains.map((train): TrainRoute => ({
        trainId: train.id,
        start: { locationId: '0', nodeId: 'city' },
        paths: fullRoutePaths
    }))
    return { state, rules: routeRules, first, second }
}

const payOnce: FleetRules = {
    sharedTrack: true,
    payOnce: {},
    trains: { '3': { hexSubsidy: 5 } }
}

it('lets a fleet’s trains share track only where its rules allow, settling them together', () => {
    const ordinary = position()
    expect(
        new RouteEvaluation(ordinary.state, ordinary.rules).evaluate('A', [
            ordinary.first,
            ordinary.second
        ]).reason
    ).toContain('share track')
    const separate = position({ fleet: { ...payOnce, sharedTrack: undefined } })
    expect(
        new RouteEvaluation(separate.state, separate.rules).evaluate('A', [
            separate.first,
            separate.second
        ]).reason
    ).toContain('share track')
    const shared = position({ fleet: payOnce })
    const result = new RouteEvaluation(shared.state, shared.rules).evaluate('A', [
        shared.first,
        shared.second
    ]).result
    expect(result?.routes.map((route) => route.revenue)).toEqual([60, 0])
    expect(result?.revenue).toBe(60)
    expect(result?.subsidy).toBe(15)
    expect(result?.routes[1].payments).toEqual([])
})

it('requires the home and connected runs only when declared', () => {
    const { state, rules, first } = position({
        fleet: { connectivity: { at: 'city', root: 'home' } }
    })
    state.stations.push({
        id: 'A:home',
        companyId: 'A',
        status: 'placed',
        position: { locationId: 'missing', nodeId: 'city', slot: 0 }
    })
    expect(new RouteEvaluation(state, rules).evaluate('A', [first]).reason).toContain('home')
    expect(new RouteEvaluation(state, rules).evaluate('A', []).result?.revenue).toBe(0)
})

it('declares paying kinds and separate payment allowances', () => {
    const { state, rules, first } = position({
        fleet: {
            trains: {
                '3': {
                    payingStopLimit: { count: 1, kinds: ['city'] }
                }
            }
        }
    })
    const result = new RouteEvaluation(state, rules).evaluate('A', [first]).result
    expect(result?.revenue).toBe(40)
    expect(result?.routes[0].payments.map((payment) => payment.locationId).sort()).toEqual([
        '1',
        '2'
    ])
})

it('omits a subsidy of nothing and keeps fleets apart from the longest route’s bonus', () => {
    const { state, rules, first } = position({ fleet: {} })
    expect(new RouteEvaluation(state, rules).evaluate('A', [first]).result).not.toHaveProperty(
        'subsidy'
    )
    expect(
        () => new RouteEvaluation(state, { ...rules, longestRouteBonusPerStop: () => 10 })
    ).toThrow('longest route')
})

it('checks a complete route’s shape and asks about each stop with the running train', () => {
    const shaped = position({
        fleet: { routeShape: { endKinds: ['city', 'offboard'] } }
    })
    const running = new RouteEvaluation(shaped.state, shaped.rules)
    expect(running.evaluate('A', [shaped.first]).result?.revenue).toBe(60)
    expect(
        running.evaluate('A', [{ ...shaped.first, paths: fullRoutePaths.slice(0, 2) }]).reason
    ).toContain('large station')
    expect(
        running.evaluateRoute('A', { ...shaped.first, paths: fullRoutePaths.slice(0, 2) }, false)
            .result
    ).toBeDefined()
    const asked: (string | undefined)[] = []
    const closed = position({
        stopAllowed: (_state, _companyId, center, train) => {
            asked.push(train?.id)
            return center.locationId !== '1' || train?.id !== '3'
        }
    })
    expect(
        new RouteEvaluation(closed.state, closed.rules).evaluate('A', [closed.first]).reason
    ).toContain('may not use')
    expect(asked).toContain('3')
    expect(asked).not.toContain(undefined)
})

it('pays a run’s subsidy from the bank to the treasury, and nothing without one', () => {
    const { state, rules, first, second } = position({ fleet: payOnce })
    const result = new RouteEvaluation(state, rules).evaluate('A', [first, second]).result!
    applyTrainRun(state, result)
    expect(state.routeStep?.result).toEqual(result)
    expect(state.companies[0].lastRunRevenue).toBe(60)
    expect(state.cash.map((cash) => cash.amount)).toEqual([985, 65])
    const ordinary = position()
    const run = new RouteEvaluation(ordinary.state, ordinary.rules).evaluate('A', [
        ordinary.first
    ]).result!
    expect(run).not.toHaveProperty('subsidy')
    applyTrainRun(ordinary.state, run)
    expect(ordinary.state.cash.map((cash) => cash.amount)).toEqual([1000, 50])
    expect(ordinary.state.companies[0].lastRunRevenue).toBe(60)
})

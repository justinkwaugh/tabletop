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

// Each stop pays once, to the first route reaching it; every town visited earns a subsidy.
const payOnce: FleetRules = {
    sharedTrack: true,
    settle(_state, _companyId, routes) {
        const paid = new Set<string>()
        let subsidy = 0
        return {
            routes: routes.map(({ result, visits }) => {
                const payments = result.payments.filter((payment) => {
                    const key = `${payment.locationId} ${payment.nodeId}`
                    if (paid.has(key)) return false
                    paid.add(key)
                    return true
                })
                subsidy += visits.filter((visit) => visit.node.kind === 'town').length * 5
                return {
                    ...result,
                    payments,
                    revenue: payments.reduce((sum, payment) => sum + payment.amount, 0)
                }
            }),
            subsidy
        }
    }
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
    expect(result?.subsidy).toBe(10)
    expect(result?.routes[1].payments).toEqual([])
})

it('rejects a fleet its title rejects and refuses a settlement that misstates revenue', () => {
    const rejected = position({ fleet: { settle: () => ({ reason: 'The runs must meet.' }) } })
    expect(
        new RouteEvaluation(rejected.state, rejected.rules).evaluate('A', [rejected.first]).reason
    ).toBe('The runs must meet.')
    expect(new RouteEvaluation(rejected.state, rejected.rules).evaluate('A', []).result).toEqual({
        companyId: 'A',
        routes: [],
        revenue: 0
    })
    const misstated = position({
        fleet: {
            settle: (_state, _companyId, routes) => ({
                routes: routes.map(({ result }) => ({ ...result, revenue: result.revenue + 1 }))
            })
        }
    })
    expect(() =>
        new RouteEvaluation(misstated.state, misstated.rules).evaluate('A', [misstated.first])
    ).toThrow('payments and bonuses')
})

it('gives settlement each route’s stops, train and hexes in order', () => {
    let seen: unknown
    const { state, rules, first } = position({
        fleet: {
            settle(_state, _companyId, routes) {
                seen = routes.map(({ train, visits, locationIds }) => ({
                    train: train.id,
                    kinds: visits.map((visit) => visit.node.kind),
                    locationIds
                }))
                return { routes: routes.map(({ result }) => result) }
            }
        }
    })
    new RouteEvaluation(state, rules).evaluate('A', [first])
    expect(seen).toEqual([
        { train: '3', kinds: ['city', 'town', 'city'], locationIds: ['0', '1', '2'] }
    ])
})

it('omits a subsidy of nothing and keeps fleets apart from the longest route’s bonus', () => {
    const { state, rules, first } = position({
        fleet: {
            settle: (_state, _companyId, routes) => ({
                routes: routes.map((r) => r.result),
                subsidy: 0
            })
        }
    })
    expect(new RouteEvaluation(state, rules).evaluate('A', [first]).result).not.toHaveProperty(
        'subsidy'
    )
    expect(
        () => new RouteEvaluation(state, { ...rules, longestRouteBonusPerStop: () => 10 })
    ).toThrow('longest route')
})

it('checks a complete route’s shape and asks about each stop with the running train', () => {
    const shaped = position({
        routeAllowed: (_state, _companyId, _train, visits) =>
            visits.at(-1)?.node.kind === 'town' ? 'A route may not end at a town.' : undefined
    })
    const running = new RouteEvaluation(shaped.state, shaped.rules)
    expect(running.evaluate('A', [shaped.first]).result?.revenue).toBe(60)
    expect(
        running.evaluate('A', [{ ...shaped.first, paths: fullRoutePaths.slice(0, 2) }]).reason
    ).toBe('A route may not end at a town.')
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
    expect(state.cash.map((cash) => cash.amount)).toEqual([990, 60])
    const ordinary = position()
    const run = new RouteEvaluation(ordinary.state, ordinary.rules).evaluate('A', [
        ordinary.first
    ]).result!
    expect(run).not.toHaveProperty('subsidy')
    applyTrainRun(ordinary.state, run)
    expect(ordinary.state.cash.map((cash) => cash.amount)).toEqual([1000, 50])
    expect(ordinary.state.companies[0].lastRunRevenue).toBe(60)
})

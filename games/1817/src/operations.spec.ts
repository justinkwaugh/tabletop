import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { Autorouter } from '@tabletop/18xx-autorouter'
import {
    RouteEvaluation,
    TrackConstruction,
    applyStationPlacement,
    companyMarketSpace,
    placeStockMarker,
    type TileRotation,
    type TrainRoute,
    type TrainRunningState,
    type EighteenXXState
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import {
    EighteenSeventeenEarningsRules,
    EighteenSeventeenRouteRules,
    EighteenSeventeenTileSet,
    EighteenSeventeenTrackRules
} from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

function construction(prepare: (state: EighteenXXState) => void = () => {}) {
    const { state } = exampleGame(EighteenSeventeenScenarios, 'construction', 3)
    expect(state.trackStep?.companyId).toBe('BA')
    prepare(state)
    return { state, track: () => new TrackConstruction(state, EighteenSeventeenTrackRules) }
}

describe('track construction', () => {
    it('allows a second yellow lay for $20 on another hex', () => {
        const { state, track } = construction()
        expect(EighteenSeventeenTrackRules.allowance(state, 'yellow')).toEqual({ cost: 0 })
        state.trackStep!.lays.push({ locationId: 'C24', color: 'yellow', cost: 15 })
        expect(EighteenSeventeenTrackRules.allowance(state, 'yellow')).toEqual({ cost: 20 })
        expect(EighteenSeventeenTrackRules.allowance(state, 'green')).toEqual({ cost: 20 })
        expect(track().choices('C24')).toEqual([])
    })

    it('allows only one upgrade a turn and no third lay', () => {
        const { state } = construction()
        state.trackStep!.lays.push({ locationId: 'C26', color: 'green', cost: 0 })
        expect(EighteenSeventeenTrackRules.allowance(state, 'green')).toHaveProperty('reason')
        expect(EighteenSeventeenTrackRules.allowance(state, 'yellow')).toEqual({ cost: 20 })
        state.trackStep!.lays.push({ locationId: 'C24', color: 'yellow', cost: 35 })
        expect(EighteenSeventeenTrackRules.allowance(state, 'yellow')).toHaveProperty('reason')
    })

    it('upgrades New York through 54 and 62 to the gray X30', () => {
        const nyChoices = (definitionId: string, phaseId: string) =>
            construction((state) => {
                state.phaseId = phaseId
                state.tileInventory = EighteenSeventeenTileSet.createInventory([
                    { locationId: 'E22', definitionId, rotation: 0 }
                ])
                applyStationPlacement(state, {
                    companyId: 'BA',
                    stationId: 'BA:station:1',
                    position: { locationId: 'E22', nodeId: 'city-0', slot: 0 },
                    cost: 0
                })
            }).track()
        expect(
            new Set(
                nyChoices('18xx:54', '5')
                    .choices('E22')
                    .map((choice) => choice.definitionId)
            )
        ).toEqual(new Set(['18xx:62']))
        expect(
            new Set(
                nyChoices('18xx:62', '7')
                    .choices('E22')
                    .map((choice) => choice.definitionId)
            )
        ).toEqual(new Set(['1817:X30']))
    })
    it('upgrades a city only to a tile of the new colour with the most exits', () => {
        const brownChoices = (
            locationId: string,
            definitionId: string,
            rotation: TileRotation,
            rules = EighteenSeventeenTrackRules
        ) => {
            const { state } = construction((state) => {
                state.phaseId = '5'
                state.tileInventory = EighteenSeventeenTileSet.createInventory([
                    { locationId, definitionId, rotation }
                ])
                applyStationPlacement(state, {
                    companyId: 'BA',
                    stationId: 'BA:station:1',
                    position: { locationId, nodeId: 'city', slot: 0 },
                    cost: 0
                })
            })
            return new Set(
                new TrackConstruction(state, rules)
                    .choices(locationId)
                    .map((choice) => choice.definitionId)
            )
        }
        const { mostExits: _, ...anyExits } = EighteenSeventeenTrackRules
        expect(brownChoices('G6', '18xx:619', 0)).toEqual(new Set(['18xx:63']))
        expect(brownChoices('G6', '18xx:619', 0, anyExits)).toEqual(
            new Set(['18xx:63', '18xx:611'])
        )
        // A #63 would run off the map here.
        expect(brownChoices('C14', '18xx:619', 0)).toEqual(new Set(['18xx:611']))
        expect(brownChoices('B5', '18xx:15', 4)).toEqual(new Set(['18xx:448']))
    })
})

describe('routes', () => {
    // New York's two cities joined by a loop through E20 and D21.
    function newYorkLoop() {
        const { state } = exampleGame(EighteenSeventeenScenarios, 'construction', 3)
        state.phaseId = '3'
        state.tileInventory = EighteenSeventeenTileSet.createInventory([
            { locationId: 'E22', definitionId: '18xx:54', rotation: 0 },
            { locationId: 'E20', definitionId: '18xx:7', rotation: 3 },
            { locationId: 'D21', definitionId: '18xx:7', rotation: 5 }
        ])
        applyStationPlacement(state, {
            companyId: 'BA',
            stationId: 'BA:station:1',
            position: { locationId: 'E22', nodeId: 'city-0', slot: 0 },
            cost: 0
        })
        const running: TrainRunningState = { ...state, routeStep: { companyId: 'BA' } }
        const train = running.trainInventory.trains.find(
            (train) =>
                train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.owner.companyId === 'BA'
        )
        assertExists(train, 'BA owns a train')
        const route: TrainRoute = {
            trainId: train.id,
            start: { locationId: 'E22', nodeId: 'city-0' },
            paths: [
                { locationId: 'E22', pathId: 'city-0-edge-1' },
                { locationId: 'E20', pathId: 'path-0' },
                { locationId: 'D21', pathId: 'path-0' },
                { locationId: 'E22', pathId: 'city-1-edge-2' }
            ]
        }
        return { state: running, route }
    }

    it('rejects a route through both New York cities', () => {
        const { state, route } = newYorkLoop()
        const { oneStopPerHex: _, ...anyStops } = EighteenSeventeenRouteRules
        expect(new RouteEvaluation(state, anyStops).evaluate('BA', [route]).result).toBeDefined()
        expect(
            new RouteEvaluation(state, EighteenSeventeenRouteRules).evaluate('BA', [route]).reason
        ).toBe('A route may stop only once in each hex.')
    })

    it('never routes through both New York cities', async () => {
        const { state, route } = newYorkLoop()
        const { oneStopPerHex: _, ...anyStops } = EighteenSeventeenRouteRules
        const bothCities = new RouteEvaluation(state, anyStops).evaluate('BA', [route]).result
        assertExists(bothCities, 'Without the rule the loop is a valid route')
        const bytes = await readFile(
            createRequire(import.meta.url).resolve('@tabletop/18xx-autorouter/solver.wasm')
        )
        const router = await Autorouter.create(new Uint8Array(bytes).buffer)
        expect(router.solve(state, anyStops, 'BA').result.revenue).toBe(bothCities.revenue)
        // The loop is BA's only route with two stops, so with the rule it has none.
        expect(router.solve(state, EighteenSeventeenRouteRules, 'BA').result).toEqual(
            expect.objectContaining({ revenue: 0, routes: [] })
        )
    })
})

describe('dividends', () => {
    function distribution(price: string, revenue: number, retained: number) {
        const { state } = exampleGame(EighteenSeventeenScenarios, 'routes', 3)
        placeStockMarker(state.stockMarket, 'BA', price)
        const effect = EighteenSeventeenEarningsRules.marketEffect(state, 'BA', {
            choice: retained === revenue ? 'withhold' : retained ? 'half-pay' : 'pay',
            revenue,
            retained,
            baseDividendPerShare: 0
        })
        return companyMarketSpace(
            {
                ...state.stockMarket,
                stacks: [{ spaceId: effect.move!.toMarketSpaceId, companyIds: ['BA'] }]
            },
            'BA'
        ).price
    }

    it('moves down when nothing is paid and up by what is paid against the share price', () => {
        expect(distribution('0:15', 80, 80)).toBe(110)
        expect(distribution('0:15', 100, 0)).toBe(120)
        expect(distribution('0:15', 120, 0)).toBe(135)
        expect(distribution('0:15', 240, 0)).toBe(150)
    })

    it('compares an acquisition-zone company with $40 and never drops it to liquidation', () => {
        expect(distribution('0:2', 40, 0)).toBe(0)
        expect(distribution('0:1', 10, 10)).toBe(0)
        expect(distribution('0:4', 10, 10)).toBe(0)
    })

    it('retains half the revenue to a multiple of the share count', () => {
        const { state } = exampleGame(EighteenSeventeenScenarios, 'routes', 3)
        const retained = (companyId: string, revenue: number) =>
            EighteenSeventeenEarningsRules.retainedRevenue(state, companyId, 'half-pay', revenue)
        expect(retained('BA', 70)).toBe(35)
        expect(retained('BA', 90)).toBe(45)
        expect(retained('PLE', 70)).toBe(35)
        expect(EighteenSeventeenEarningsRules.shareCount(state, 'PLE')).toBe(1)
        expect(EighteenSeventeenEarningsRules.shareCount(state, 'BA')).toBe(5)
    })
})

import { describe, expect, it } from 'vitest'
import {
    TrackConstruction,
    applyStationPlacement,
    companyMarketSpace,
    placeStockMarker,
    type EighteenXXState
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import {
    EighteenSeventeenEarningsRules,
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

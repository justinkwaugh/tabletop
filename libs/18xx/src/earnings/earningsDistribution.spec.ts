import { expect, it } from 'vitest'
import {
    EarningsDistribution,
    type DistributionState,
    type EarningsRules
} from './earningsDistribution.js'
import {
    companyMarketSpace,
    createRectangularStockMarket,
    moveMarketSpace,
    placeStockMarker
} from '../stock/stockMarket.js'

it('passes the chosen payout and calculated dividend to market policy without mutating the state', () => {
    const market = createRectangularStockMarket([[100, 110, 120]], () => 'white')
    placeStockMarker(market, 'R', '0:0')
    const state: DistributionState = {
        companies: [{ id: 'R', name: 'Railway', kind: 'major', shareCount: 10 }],
        bank: { name: 'Bank' },
        cash: [{ owner: { kind: 'bank' }, amount: 'unlimited' }],
        certificates: [],
        certificatePools: [],
        stations: [],
        stationReservations: [],
        tileInventory: { tileSetId: 'tiles', placements: {}, retiredPieceIds: [] },
        trainInventory: { depotId: 'trains', trains: [], nextTrainNumber: 1 },
        phaseId: '3',
        stockMarket: market,
        routeStep: { companyId: 'R', result: { companyId: 'R', routes: [], revenue: 200 } }
    }
    const rules: EarningsRules = {
        choices: () => ['pay', 'half-pay', 'withhold'],
        shareCount: () => 10,
        entitlements: () => [],
        retainedRevenue: (_state, _id, choice, revenue) =>
            choice === 'pay' ? 0 : choice === 'half-pay' ? revenue / 2 : revenue,
        roundDividend: (_state, _id, amount) => amount,
        marketEffect(current, companyId, distribution) {
            expect(distribution.baseDividendPerShare).toBe(
                (distribution.revenue - distribution.retained) / 10
            )
            const from = companyMarketSpace(current.stockMarket, companyId)
            const to = moveMarketSpace(
                current.stockMarket,
                from.id,
                'right',
                Math.floor((distribution.revenue - distribution.retained) / from.price)
            )
            return {
                bonusPerShare: 0,
                move: { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id }
            }
        }
    }
    const before = structuredClone(state)
    const distribution = new EarningsDistribution(state, rules)
    expect(distribution.evaluate('R', 'pay').details?.marketMove?.toMarketSpaceId).toBe('0:2')
    expect(distribution.evaluate('R', 'half-pay').details?.marketMove?.toMarketSpaceId).toBe('0:1')
    expect(distribution.evaluate('R', 'withhold').details?.marketMove?.toMarketSpaceId).toBe('0:0')
    expect(state).toEqual(before)
})

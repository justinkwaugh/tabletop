import { describe, expect, it } from 'vitest'
import { Color, assertExists } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    getCompany,
    openShares,
    presidentCertificate
} from '../finance/finance.js'
import { createRectangularStockMarket, placeStockMarker } from '../stock/stockMarket.js'
import { createStockRound } from '../stock/stockRound.js'
import { purchaseOwnershipCeiling } from '../stock/stockRules.js'
import { ipoMarketTrading } from '../stock/ipoMarketTrading.js'
import { marketZoneHoldingLimits } from '../stock/marketZoneLimits.js'
import { presidentTrainFundingRules } from '../funding/presidentTrainFunding.js'
import type { FundingState } from '../funding/trainFunding.js'
import { payOrWithholdEarningsRules } from '../earnings/payOrWithhold.js'
import { EarningsDistribution, type DistributionState } from '../earnings/earningsDistribution.js'
import { fullCapitalizationCompanyRules } from './fullCapitalization.js'

const bank = { kind: 'bank' } as const
const player = { kind: 'player', playerId: 'alex' } as const
const other = { kind: 'player', playerId: 'blair' } as const
const company = { kind: 'company', companyId: 'A' } as const
const ipo = { owner: bank, poolId: 'ipo' }
const trading = ipoMarketTrading({ ipoPoolId: 'ipo', marketPoolId: 'market', marketLimit: 50 })

function position(): FundingState & DistributionState {
    const stockMarket = createRectangularStockMarket([[60, 70, 80]], () => 'pink')
    placeStockMarker(stockMarket, 'A', '0:1')
    return {
        bank: { name: 'Bank' },
        companies: [
            {
                id: 'A',
                name: 'Alpha',
                kind: 'major',
                shareCount: 10,
                started: true,
                floated: true,
                president: player,
                parPrice: 60
            }
        ],
        certificates: createOrdinaryShareCertificates(
            'A',
            [
                { owner: player },
                { owner: player },
                { owner: player },
                { owner: player },
                ipo,
                ipo,
                { owner: bank, poolId: 'market' },
                { owner: other }
            ],
            player
        ),
        cash: [
            { owner: bank, amount: 10000 },
            { owner: player, amount: 500 },
            { owner: other, amount: 500 },
            { owner: company, amount: 0 }
        ],
        certificatePools: [
            { id: 'ipo', name: 'IPO', owner: bank },
            { id: 'market', name: 'Market', owner: bank }
        ],
        players: [
            { playerId: 'alex', color: Color.Blue },
            { playerId: 'blair', color: Color.Red }
        ],
        activePlayerIds: ['alex'],
        turnManager: { turnOrder: ['alex', 'blair'], series: [], turnCounts: {} },
        phaseId: '2',
        phaseEvents: [],
        usedPrivatePowerIds: [],
        ownershipLimitExemptions: [],
        tranches: [],
        stations: [],
        stationReservations: [],
        stockRound: createStockRound(2),
        stockMarket,
        machineState: 'StockRound',
        tileInventory: { tileSetId: 'tiles', placements: {}, retiredPieceIds: [] },
        trainInventory: { depotId: 'depot', trains: [], nextTrainNumber: 1 }
    }
}

describe('IPO and market trading', () => {
    it('prices IPO shares at par and market shares at the market, including their denominations', () => {
        const state = position()
        const shares = openShares(state, 'A')
        const initial = shares.find((share) => share.poolId === 'ipo')
        const market = shares.find((share) => share.poolId === 'market')
        assertExists(initial, 'IPO holds a share')
        assertExists(market, 'Market holds a share')
        initial.shares = 2
        expect(trading.purchaseTerms(state, initial, player)).toEqual({
            price: 120,
            recipient: bank,
            payers: [player]
        })
        expect(trading.purchaseTerms(state, market, player)).toEqual({
            price: 70,
            recipient: bank,
            payers: [player]
        })
        market.owner = other
        expect(trading.purchaseTerms(state, market, player)).toBe(
            'This certificate is not available for purchase.'
        )
        const president = presidentCertificate(state, 'A')
        assertExists(president, 'Company has a president certificate')
        expect(trading.purchaseTerms(state, president, player)).toBe(
            'Start the company to buy its president’s certificate.'
        )
        getCompany(state, 'A').closed = true
        expect(trading.purchaseTerms(state, initial, player)).toBe(
            'This company has not started or is closed.'
        )
    })

    it('keeps the first-round stock restriction out of emergency sales', () => {
        const state = position()
        state.stockRound.number = 1
        expect(trading.stockSaleTerms(state, 'A', 2, player)).toBe(
            'Shares cannot be sold in the first stock round.'
        )
        const sale = {
            payer: bank,
            price: 70,
            destinationPoolId: 'market',
            marketLimit: 50,
            maximumShares: 10,
            movement: 2,
            direction: 'down'
        }
        expect(trading.emergencySaleTerms(state, 'A', 2, player)).toEqual(sale)
        state.stockRound.number = 2
        expect(trading.stockSaleTerms(state, 'A', 2, player)).toEqual(sale)
        getCompany(state, 'A').closed = true
        expect(trading.emergencySaleTerms(state, 'A', 2, player)).toBe(
            'This company has no saleable shares.'
        )
    })
})

describe('full capitalization from IPO sales', () => {
    it('prices the actual president denomination and offers only the configured par spaces', () => {
        const state = position()
        const rules = fullCapitalizationCompanyRules({
            ipoPoolId: 'ipo',
            parSpaceColor: 'pink',
            floatPercent: 60
        })
        state.certificates = createOrdinaryShareCertificates(
            'A',
            Array.from({ length: 7 }, () => ipo),
            ipo
        )
        const president = presidentCertificate(state, 'A')
        assertExists(president, 'Company has a president certificate')
        president.shares = 3
        state.stockMarket.spaces[0].color = 'white'
        expect(rules.startMarketSpaces(state, 'A')).toEqual(['0:1', '0:2'])
        expect(rules.startTerms(state, 'A', player, '0:1')).toEqual({
            price: 210,
            recipient: bank,
            payers: [player]
        })
    })

    it.each([50, 60])(
        'pays once at %i percent, counting shares outside the IPO',
        (floatPercent) => {
            const state = position()
            const rules = fullCapitalizationCompanyRules({
                ipoPoolId: 'ipo',
                parSpaceColor: 'pink',
                floatPercent
            })
            state.certificates = createOrdinaryShareCertificates(
                'A',
                Array.from({ length: 8 }, () => ipo),
                ipo
            )
            expect(rules.startTerms(state, 'A', player, '0:1')).toEqual({
                price: 140,
                recipient: bank,
                payers: [player]
            })
            const shares = openShares(state, 'A')
            const president = presidentCertificate(state, 'A')
            assertExists(president, 'President is available')
            president.owner = player
            delete president.poolId
            for (const share of shares
                .filter((share) => !share.president)
                .slice(0, floatPercent / 10 - 3)) {
                share.owner = player
                delete share.poolId
            }
            expect(rules.sharesToFloat?.(state, 'A')).toBe(1)
            expect(rules.flotationPayments(state, 'A')).toBeUndefined()
            const last = shares.find((share) => share.poolId === 'ipo')
            assertExists(last, 'IPO still has shares')
            last.poolId = 'market'
            expect(rules.sharesToFloat?.(state, 'A')).toBe(0)
            expect(rules.flotationPayments(state, 'A')).toEqual([
                { from: bank, to: company, amount: 600 }
            ])
            getCompany(state, 'A').funded = true
            expect(rules.flotationPayments(state, 'A')).toEqual([])
            expect(rules.startTerms(state, 'A', player, '0:1')).toBe(
                'The president’s certificate must be available in the IPO.'
            )
        }
    )
})

describe('pay or withhold distributions', () => {
    it('pays market holdings to the company, leaves IPO dividends in the bank, and moves only floated shares', () => {
        const state = position()
        const rules = payOrWithholdEarningsRules({
            unpaidPoolIds: ['ipo'],
            companyPoolIds: ['market']
        })
        state.routeStep = { companyId: 'A', result: { companyId: 'A', revenue: 100, routes: [] } }
        const distribution = new EarningsDistribution(state, rules)
        expect(distribution.evaluate('A', 'pay').details).toMatchObject({
            retained: 0,
            dividendPerShare: 10,
            payments: [
                { from: bank, to: player, amount: 60 },
                { from: bank, to: company, amount: 10 },
                { from: bank, to: other, amount: 10 }
            ],
            marketMove: { fromMarketSpaceId: '0:1', toMarketSpaceId: '0:2' }
        })
        expect(distribution.evaluate('A', 'withhold').details).toMatchObject({
            retained: 100,
            payments: [{ from: bank, to: company, amount: 100 }],
            marketMove: { fromMarketSpaceId: '0:1', toMarketSpaceId: '0:0' }
        })
        expect(distribution.evaluate('A', 'half-pay').reason).toBeDefined()
        getCompany(state, 'A').floated = false
        expect(distribution.evaluate('A', 'pay').details?.marketMove).toBeUndefined()
    })
})

describe('ownership policy shared with emergency funding', () => {
    it('uses the supplied ownership percentage and exemptions rather than another 60-percent calculation', () => {
        const state = position()
        const limits = marketZoneHoldingLimits({
            certificateFreeColors: ['yellow', 'orange'],
            ownershipFreeColors: ['orange'],
            ownershipPercent: 50
        })
        const rules = presidentTrainFundingRules({
            companyOrder: () => ['A'],
            saleTerms: trading.emergencySaleTerms,
            stockRules: limits,
            protectsPresidency: () => true
        })
        expect(purchaseOwnershipCeiling(state, 'A', player, limits)).toBe(5)
        expect(rules.requiredSaleShares(state, player, 'A')).toBe(1)
        const marker = state.stockMarket.spaces[1]
        const share = openShares(state, 'A')[0]
        marker.color = 'yellow'
        expect(limits.certificateWeight(state, share)).toBe(0)
        expect(rules.requiredSaleShares(state, player, 'A')).toBe(1)
        marker.color = 'orange'
        expect(purchaseOwnershipCeiling(state, 'A', player, limits)).toBe(10)
        expect(rules.requiredSaleShares(state, player, 'A')).toBe(0)
        marker.color = 'pink'
        getCompany(state, 'A').closed = true
        expect(rules.requiredSaleShares(state, player, 'A')).toBe(0)
    })
})

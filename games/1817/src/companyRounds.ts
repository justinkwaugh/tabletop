import {
    AcquisitionRounds,
    CompanyConversions,
    CompanyExcess,
    CompanySales,
    ConversionRounds,
    CorporateBuyBacks,
    Liquidations,
    ShortSelling,
    controllingOwner,
    type CashPayment,
    type SizedCompanyState
} from '@tabletop/18xx'
import { EighteenSeventeenEndingRules } from './endingRules.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import { EighteenSeventeenCompanyMarket } from './marketZones.js'
import { EighteenSeventeenStations } from './owedStations.js'
import { GoldenParachuteId, companyHolding } from './privateHolders.js'
import type { EighteenSeventeenOptions, HydratedEighteenSeventeenState } from './state.js'
import { eighteenSeventeenOptions } from './state.js'
import { EighteenSeventeenStockRules } from './stockRules.js'
import { EighteenSeventeenTrainRules } from './trains.js'

const Market = EighteenSeventeenCompanyMarket
const FiveShorts = 5
const GoldenParachuteValue = 100

export const EighteenSeventeenLiquidations = new Liquidations(Market)

/**
 * Shorts stay below the company's share count, or five with the 5 Shorts option, and none is
 * opened in phase 8.
 */
export const EighteenSeventeenShortSelling = new ShortSelling({
    market: Market,
    stockRules: EighteenSeventeenStockRules,
    maximumShorts: (state: SizedCompanyState & EighteenSeventeenOptions, companyId) =>
        eighteenSeventeenOptions(state).fiveShorts
            ? Math.min(FiveShorts, Market.shareCount(state, companyId))
            : Market.shareCount(state, companyId),
    closedPhaseIds: ['8']
})

export const EighteenSeventeenBuyBacks = new CorporateBuyBacks({
    market: Market,
    loanRules: EighteenSeventeenLoanRules,
    stockRules: EighteenSeventeenStockRules
})

/** 2-share companies become 5-share and 5-share 10-share, by conversion or by merging two. */
export const EighteenSeventeenConversions = new CompanyConversions({
    market: Market,
    stations: EighteenSeventeenStations,
    trainRules: EighteenSeventeenTrainRules,
    conversions: { 2: 5, 5: 10 },
    mergerPresidencyPercent: 40
})

export const EighteenSeventeenConversionRounds =
    new ConversionRounds<HydratedEighteenSeventeenState>({
        market: Market,
        conversions: EighteenSeventeenConversions,
        stockRules: EighteenSeventeenStockRules,
        loanRules: EighteenSeventeenLoanRules,
        valuationRules: EighteenSeventeenEndingRules
    })

function payGoldenParachute(playerId: string): CashPayment {
    return {
        from: { kind: 'bank' },
        to: { kind: 'player', playerId },
        amount: GoldenParachuteValue
    }
}

/**
 * Bids rise in $10 steps. The Golden Parachute pays its company's president $100 when another
 * president's company buys it, or when the bank liquidates it while it still has a president.
 */
export const EighteenSeventeenSales = new CompanySales({
    market: Market,
    conversions: EighteenSeventeenConversions,
    loanRules: EighteenSeventeenLoanRules,
    trainRules: EighteenSeventeenTrainRules,
    increment: 10,
    acquisitionPayment(state, companyId, buyerId) {
        if (companyHolding(state, GoldenParachuteId) !== companyId) return undefined
        const president = controllingOwner(state, companyId)
        if (!president || controllingOwner(state, buyerId)?.playerId === president.playerId)
            return undefined
        return payGoldenParachute(president.playerId)
    },
    liquidationPayment(state, companyId) {
        if (companyHolding(state, GoldenParachuteId) !== companyId) return undefined
        const president = controllingOwner(state, companyId)
        return president ? payGoldenParachute(president.playerId) : undefined
    }
})

export const EighteenSeventeenAcquisitionRounds =
    new AcquisitionRounds<HydratedEighteenSeventeenState>({
        sales: EighteenSeventeenSales,
        valuationRules: EighteenSeventeenEndingRules
    })

export const EighteenSeventeenCompanyExcess = new CompanyExcess<HydratedEighteenSeventeenState>({
    conversions: EighteenSeventeenConversions,
    trainRules: EighteenSeventeenTrainRules,
    conversionRounds: EighteenSeventeenConversionRounds,
    acquisitionRounds: EighteenSeventeenAcquisitionRounds
})

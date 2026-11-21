import {
    AcquisitionRounds,
    CompanyConversions,
    CompanyExcess,
    CompanySales,
    ConversionRounds,
    CorporateBuyBacks,
    Liquidations,
    ShortSelling
} from '@tabletop/18xx'
import { EighteenUSAEndingRules } from './endingRules.js'
import { EighteenUSALoanRules } from './loanRules.js'
import { EighteenUSACompanyMarket } from './marketZones.js'
import { EighteenUSAStations } from './owedStations.js'
import type { HydratedEighteenUSAState } from './state.js'
import { EighteenUSAStockRules } from './stockRules.js'
import { EighteenUSATrainRules } from './trainRules.js'
import { ScrapPullmanCompanyAction } from './pullmans.js'
import { EighteenUSATrainDepot } from './trains.js'

const Market = EighteenUSACompanyMarket

export const EighteenUSALiquidations = new Liquidations(Market, EighteenUSATrainDepot)

/** A company may be shorted up to its share count, and none is opened in phase 8 (§11.2, §8). */
export const EighteenUSAShortSelling = new ShortSelling({
    market: Market,
    stockRules: EighteenUSAStockRules,
    maximumShorts: (state, companyId) => Market.shareCount(state, companyId),
    closedPhaseIds: ['8']
})

export const EighteenUSABuyBacks = new CorporateBuyBacks({
    market: Market,
    loanRules: EighteenUSALoanRules,
    stockRules: EighteenUSAStockRules
})

/** 2-share companies become 5-share and 5-share 10-share, by conversion or by merging two (§14.1). */
export const EighteenUSAConversions = new CompanyConversions({
    market: Market,
    stations: EighteenUSAStations,
    trainRules: EighteenUSATrainRules,
    conversions: { 2: 5, 5: 10 },
    mergerPresidencyPercent: 40
})

export const EighteenUSAConversionRounds = new ConversionRounds<HydratedEighteenUSAState>({
    market: Market,
    conversions: EighteenUSAConversions,
    stockRules: EighteenUSAStockRules,
    loanRules: EighteenUSALoanRules,
    valuationRules: EighteenUSAEndingRules,
    companyActions: [ScrapPullmanCompanyAction]
})

/** Bids for companies rise in $10 steps (§14.2). */
export const EighteenUSASales = new CompanySales({
    market: Market,
    conversions: EighteenUSAConversions,
    loanRules: EighteenUSALoanRules,
    trainRules: EighteenUSATrainRules,
    increment: 10
})

export const EighteenUSAAcquisitionRounds = new AcquisitionRounds<HydratedEighteenUSAState>({
    sales: EighteenUSASales,
    valuationRules: EighteenUSAEndingRules,
    companyActions: [ScrapPullmanCompanyAction]
})

export const EighteenUSACompanyExcess = new CompanyExcess<HydratedEighteenUSAState>({
    conversions: EighteenUSAConversions,
    trainRules: EighteenUSATrainRules,
    conversionRounds: EighteenUSAConversionRounds,
    acquisitionRounds: EighteenUSAAcquisitionRounds
})

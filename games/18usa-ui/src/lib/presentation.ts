import {
    EighteenUSAMarket,
    EighteenUSATitleRules,
    MarketPoolId,
    ParPriceRange,
    type EighteenUSAState
} from '@tabletop/18usa'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import {
    activeAcquisitionRound,
    activeConversionRound,
    isEndAcquisitionRound,
    isEndConversionRound,
    isStartAcquisitionRound,
    isStartConversionRound
} from '@tabletop/18xx'
import { EighteenUSACompanyNames } from './companyPresentation.js'
import { eighteenUSAMarkerArt } from './mapTokens.js'
import { EighteenUSAPhaseChart, eighteenUSAPhaseChart } from './phaseChart.js'
import {
    EighteenUSACompanyColumns,
    EighteenUSAMarketZones,
    eighteenUSACompanyFacts,
    eighteenUSAHomeNotes,
    eighteenUSAGameFacts
} from './titleFacts.js'
import { EighteenUSAPhaseColors, EighteenUSATrainColors } from './trainPresentation.js'

export const EighteenUSAPresentation: TitlePresentation<EighteenUSAState> = {
    money: moneyFormat(EighteenUSATitleRules.currencySymbol),
    phaseChart: EighteenUSAPhaseChart,
    phaseChartFor: eighteenUSAPhaseChart,
    trainColors: EighteenUSATrainColors,
    phaseColors: EighteenUSAPhaseColors,
    marketPoolId: MarketPoolId,
    companyNames: EighteenUSACompanyNames,
    gameFacts: eighteenUSAGameFacts,
    companyColumns: EighteenUSACompanyColumns,
    companyFacts: eighteenUSACompanyFacts,
    homeNotes: eighteenUSAHomeNotes,
    markerArtFor: eighteenUSAMarkerArt,
    marketCell: { width: 48, height: 124 },
    marketWraps: [
        EighteenUSAMarket.spaces.findIndex((space) => space.price > ParPriceRange.maximum)
    ],
    marketZones: EighteenUSAMarketZones,
    privatesWithoutValue: true,
    privatesWithoutIncome: true,
    biddingPowerShown: (state) => state.operatingSet === undefined,
    titleRounds: [
        {
            name: 'Merger round',
            abbreviation: 'MR',
            inProgress: (state) => !!activeConversionRound(state),
            starts: isStartConversionRound,
            ends: isEndConversionRound
        },
        {
            name: 'Acquisition round',
            abbreviation: 'AR',
            inProgress: (state) => !!activeAcquisitionRound(state),
            starts: isStartAcquisitionRound,
            ends: isEndAcquisitionRound
        }
    ]
}

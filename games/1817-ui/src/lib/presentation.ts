import { EighteenSeventeenTitleRules, type EighteenSeventeenState } from '@tabletop/1817'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { MarketPoolId } from '@tabletop/1817'
import {
    activeAcquisitionRound,
    activeConversionRound,
    isEndAcquisitionRound,
    isEndConversionRound,
    isStartAcquisitionRound,
    isStartConversionRound
} from '@tabletop/18xx'
import { EighteenSeventeenCompanyNames } from './companyPresentation.js'
import { EighteenSeventeenPhaseChart } from './phaseChart.js'
import {
    EighteenSeventeenCompanyColumns,
    EighteenSeventeenMarketZones,
    eighteenSeventeenCompanyFacts,
    eighteenSeventeenGameFacts
} from './titleFacts.js'
import { EighteenSeventeenTrainColors } from './trainPresentation.js'

export const EighteenSeventeenPresentation: TitlePresentation<EighteenSeventeenState> = {
    money: moneyFormat(EighteenSeventeenTitleRules.currencySymbol),
    phaseChart: EighteenSeventeenPhaseChart,
    trainColors: EighteenSeventeenTrainColors,
    phaseColors: EighteenSeventeenTrainColors,
    marketPoolId: MarketPoolId,
    companyNames: EighteenSeventeenCompanyNames,
    gameFacts: eighteenSeventeenGameFacts,
    companyColumns: EighteenSeventeenCompanyColumns,
    companyFacts: eighteenSeventeenCompanyFacts,
    marketCell: { width: 30, height: 110 },
    marketZones: EighteenSeventeenMarketZones,
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

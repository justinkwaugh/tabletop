import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import {
    MarketPoolId,
    activeAcquisitionRound,
    activeMergerRound,
    isEndAcquisitionRound,
    isEndMergerRound,
    isStartAcquisitionRound,
    isStartMergerRound
} from '@tabletop/1817'
import { EighteenSeventeenCompanyNames } from './companyPresentation.js'
import { EighteenSeventeenPhaseChart } from './phaseChart.js'
import { EighteenSeventeenTrainColors } from './trainPresentation.js'

export const EighteenSeventeenPresentation: TitlePresentation = {
    money: moneyFormat('$'),
    phaseChart: EighteenSeventeenPhaseChart,
    trainColors: EighteenSeventeenTrainColors,
    phaseColors: EighteenSeventeenTrainColors,
    marketPoolId: MarketPoolId,
    companyNames: EighteenSeventeenCompanyNames,
    poolName: (pool) => (pool.id.startsWith('treasury:') ? 'Treasury' : pool.name),
    titleRounds: [
        {
            name: 'Merger round',
            abbreviation: 'MR',
            inProgress: (state) => !!activeMergerRound(state),
            starts: isStartMergerRound,
            ends: isEndMergerRound
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

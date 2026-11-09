import {
    IpoPoolId,
    MarketPoolId,
    MarketZoneColors1862,
    ParliamentState,
    permitsOf,
    TitleRules1862,
    type State1862
} from '@tabletop/1862'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNames1862 } from './companyPresentation.js'
import { PermitNames, permitImage } from './permits.js'
import { PhaseChart1862 } from './phaseChart.js'
import { PhaseColors1862, TrainColors1862 } from './trainPresentation.js'

export const Presentation1862: TitlePresentation<State1862> = {
    money: moneyFormat(TitleRules1862.currencySymbol),
    phaseChart: PhaseChart1862,
    trainColors: TrainColors1862,
    phaseColors: PhaseColors1862,
    marketPoolId: MarketPoolId,
    ipoPoolId: IpoPoolId,
    companyNames: CompanyNames1862,
    openingRound: {
        name: 'Parliament round',
        abbreviation: 'Parliament',
        inProgress: (state) => state.machineState === ParliamentState
    },
    // A company's train permits, which say which of its trains run (§6.5.4.3).
    companyMarks: (state, companyId) =>
        permitsOf(state, companyId).map((kind) => ({
            label: `${PermitNames[kind]} permit`,
            description: `${PermitNames[kind]} trains run for this company.`,
            imageUrl: permitImage(kind)
        })),
    companyFacts: (state, companyId) =>
        state.companies.find((company) => company.id === companyId)?.started
            ? [
                  {
                      label: 'Capital',
                      value: state.chartered.includes(companyId) ? 'Full' : 'Partial'
                  }
              ]
            : [],
    // After each set of operating rounds, Parliament sits before the stock round (§3).
    titleRounds: [
        {
            name: 'Parliament round',
            abbreviation: 'Parliament',
            inProgress: (state) => !!state.parliament && !!state.operatingSet,
            starts: (action) => action.type === 'StartParliamentRound',
            ends: (action) => action.type === 'EndParliamentRound'
        }
    ],
    // Sixty-seven spaces in four rows of seventeen.
    marketCell: { width: 52, height: 62 },
    // §4.2, §6.4.2, §6.5.3, §7.12, §10.1.
    marketZones: [
        {
            color: MarketZoneColors1862.charteredPar,
            name: 'Chartered par',
            description:
                'A par a company chartered by Parliament may take, and a price a non-chartered company may start at.'
        },
        {
            color: MarketZoneColors1862.nonCharteredPar,
            name: 'Non-chartered start',
            description: 'A price a non-chartered company may start at.'
        },
        {
            color: MarketZoneColors1862.ignoreOneSale,
            name: 'One sale ignored',
            description: 'The first share a non-director sells does not move the price.'
        },
        {
            color: MarketZoneColors1862.ignoreTwoSales,
            name: 'Two sales ignored',
            description: 'The first two shares a non-director sells do not move the price.'
        },
        {
            color: MarketZoneColors1862.bankruptcy,
            name: 'Bankruptcy',
            description: 'A company whose price reaches it goes bankrupt.'
        },
        {
            color: MarketZoneColors1862.gameEnd,
            name: 'Game end',
            description: 'A company reaching it ends the game after the operating round.'
        }
    ]
}

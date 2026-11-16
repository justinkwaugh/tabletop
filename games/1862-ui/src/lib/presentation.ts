import {
    IpoPoolId,
    MarketPoolId,
    MarketZoneColors1862,
    ParliamentState,
    permitsOf,
    TitleRules1862,
    trainWarranties,
    type State1862
} from '@tabletop/1862'
import { controllingOwner } from '@tabletop/18xx'
import { moneyFormat, type CompanyMark, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNames1862 } from './companyPresentation.js'
import { PermitNames, permitImage } from './permits.js'
import { PhaseChart1862 } from './phaseChart.js'
import { PhaseColors1862, TrainColors1862 } from './trainPresentation.js'

// A company's train permits, which say which of its trains run (§6.5.4.3).
function permitMarks(state: State1862, companyId: string): CompanyMark[] {
    return permitsOf(state, companyId).map((kind) => ({
        label: `${PermitNames[kind]} permit`,
        description: `${PermitNames[kind]} trains run for this company.`,
        imageUrl: permitImage(kind),
        compact: true
    }))
}

export const Presentation1862: TitlePresentation<State1862> = {
    money: moneyFormat(TitleRules1862.currencySymbol),
    phaseChart: PhaseChart1862,
    trainColors: TrainColors1862,
    // Stations are bought as the company floats (§7.7), so placing one costs nothing.
    hideStationCosts: true,
    phaseColors: PhaseColors1862,
    marketPoolId: MarketPoolId,
    ipoPoolId: IpoPoolId,
    companyNames: CompanyNames1862,
    openingRound: {
        name: 'Parliament round',
        abbreviation: 'Parliament',
        inProgress: (state) => state.machineState === ParliamentState
    },
    companyMarks: permitMarks,
    // A director chooses each train's route and need not run for the most (§7.8); a company in
    // receivership runs for as much as it can (§7.3), so it runs the best routes found.
    manualRoutes: (state, companyId) => controllingOwner(state, companyId) !== undefined,
    companyColumns: [
        {
            id: 'permits',
            label: 'Permits',
            text: (state, companyId) =>
                permitsOf(state, companyId)
                    .map((kind) => PermitNames[kind])
                    .join(', '),
            marks: permitMarks
        }
    ],
    // A train's warranties; one whose band has retired runs on only while they last (§7.10).
    trainTokens: (state, train) => {
        const { count, lapsing } = trainWarranties(state, train)
        const held = count === 1 ? '1 warranty' : `${count} warranties`
        const runs = count === 1 ? 'its next run' : `${count} more runs`
        return {
            count,
            lapsing,
            description: count ? (lapsing ? `${held}: rusts after ${runs}` : held) : ''
        }
    },
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
    // Sixty-seven narrow spaces zig-zagging between two rows, each half a space on from the last.
    marketCell: { width: 32, height: 64, step: 16 },
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

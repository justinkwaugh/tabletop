import {
    CoalTokens,
    isCompleteMergerPhase,
    isStartMergerPhase,
    EighteenThirtyTwoSoftLedge,
    type EighteenThirtyTwoState
} from '@tabletop/1832'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { EighteenThirtyTwoCompanyNames } from './companyPresentation.js'
import { EighteenThirtyTwoPhaseChart, eighteenThirtyTwoPhaseChart } from './phaseChart.js'
import { EighteenThirtyTwoTrainColors } from './trainPresentation.js'
import { eighteenThirtyTwoMapPlacement } from './history.js'
import CottonToken from './images/tokens/cotton.svg'
import PortToken from './images/tokens/port.svg'
import UnknownToken from './images/tokens/unknown.svg'

// A System names its letter and the two companies it was formed from (§11.6).
export const EighteenThirtyTwoPresentation: TitlePresentation<EighteenThirtyTwoState> = {
    money: moneyFormat('$'),
    phaseChart: EighteenThirtyTwoPhaseChart,
    phaseChartFor: eighteenThirtyTwoPhaseChart,
    trainColors: EighteenThirtyTwoTrainColors,
    phaseColors: EighteenThirtyTwoTrainColors,
    marketPoolId: 'open-market',
    ipoPoolId: 'initial-offering',
    companyNames: EighteenThirtyTwoCompanyNames,
    privatePurchaseHeading: 'Available privates',
    historyMapPlacement: eighteenThirtyTwoMapPlacement,
    privateTokens: {
        P2: { imageUrl: CottonToken },
        P3: { imageUrl: PortToken },
        P4: { imageUrl: UnknownToken },
        P7: { companyId: 'CG' }
    },
    gameFacts: (state) => [{ label: 'Coal', value: String(CoalTokens - state.coalRights.length) }],
    companyMarks: (state, companyId) =>
        state.coalRights.includes(companyId)
            ? [
                  {
                      label: 'Coal',
                      description:
                          'West Virginia Coal Fields rights: its trains may run to the coal fields.'
                  }
              ]
            : [],
    companyOrigin: (state, companyId) => {
        const components = state.systems[companyId]
        return components ? { text: 'System of', companyIds: components } : undefined
    },
    titleRounds: [
        {
            name: 'Merger phase',
            abbreviation: 'MP',
            inProgress: (state) => !!state.mergerPhase,
            starts: (action) => isStartMergerPhase(action) && !!action.metadata?.held,
            ends: isCompleteMergerPhase,
            followsStockRound: true
        }
    ],
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A price a company may start at.' },
        {
            color: 'yellow',
            name: 'Yellow',
            description: 'Shares do not count toward the certificate limit.'
        },
        {
            color: 'green',
            name: 'Green',
            description: 'Shares do not count toward the limit and may exceed 60%.'
        },
        {
            color: 'brown',
            name: 'Brown',
            description:
                'As green, and a player may buy every open-market share of one company in a turn.'
        },
        { color: 'black', name: 'Closed', description: 'A company entering it closes.' }
    ],
    marketLedge: {
        name: 'Soft ledge',
        description:
            'A sale with one space left to fall stops on the ledge; a rightward move meeting it goes up.',
        edges: EighteenThirtyTwoSoftLedge
    }
}

import {
    EighteenThirtyTwoSoftLedge,
    miamiFirstRun,
    type EighteenThirtyTwoState
} from '@tabletop/1832'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { EighteenThirtyTwoCompanyNames } from './companyPresentation.js'
import { EighteenThirtyTwoPhaseChart } from './phaseChart.js'
import { EighteenThirtyTwoTrainColors } from './trainPresentation.js'

const CoalTokens = 5

export const EighteenThirtyTwoPresentation: TitlePresentation<EighteenThirtyTwoState> = {
    money: moneyFormat('$'),
    phaseChart: EighteenThirtyTwoPhaseChart,
    trainColors: EighteenThirtyTwoTrainColors,
    phaseColors: EighteenThirtyTwoTrainColors,
    marketPoolId: 'open-market',
    companyNames: EighteenThirtyTwoCompanyNames,
    privatePurchaseHeading: 'Available privates',
    privateTokens: { P7: { companyId: 'CG' } },
    gameFacts: (state) => [
        { label: 'WVCF tokens left', value: String(CoalTokens - state.coalRights.length) },
        ...(miamiFirstRun(state) ? [{ label: 'Miami', value: '$0 on its first run' }] : [])
    ],
    companyFacts: (state, companyId) =>
        state.coalRights.includes(companyId) ? [{ label: 'Coal fields', value: 'WVCF token' }] : [],
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

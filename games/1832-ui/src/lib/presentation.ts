import {
    CoalTokens,
    EighteenThirtyTwoSystems,
    isCompleteMergerPhase,
    isStartMergerPhase,
    EighteenThirtyTwoSoftLedge,
    miamiFirstRun,
    type EighteenThirtyTwoState
} from '@tabletop/1832'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { EighteenThirtyTwoCompanyNames } from './companyPresentation.js'
import { EighteenThirtyTwoPhaseChart, eighteenThirtyTwoPhaseChart } from './phaseChart.js'
import { EighteenThirtyTwoTrainColors } from './trainPresentation.js'

// A System names its letter and the two companies it was formed from (§11.6).
function systemFacts(state: EighteenThirtyTwoState, companyId: string) {
    const system = EighteenThirtyTwoSystems.find((entry) => entry.id === companyId)
    const components = state.systems[companyId]
    if (!system || !components) return []
    const names = components.map((id) => EighteenThirtyTwoCompanyNames[id]?.initials ?? id)
    return [{ label: `System ${system.letter}`, value: names.join(' & ') }]
}

export const EighteenThirtyTwoPresentation: TitlePresentation<EighteenThirtyTwoState> = {
    money: moneyFormat('$'),
    phaseChart: EighteenThirtyTwoPhaseChart,
    phaseChartFor: eighteenThirtyTwoPhaseChart,
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
    companyFacts: (state, companyId) => [
        ...systemFacts(state, companyId),
        ...(state.coalRights.includes(companyId)
            ? [{ label: 'Coal fields', value: 'WVCF token' }]
            : [])
    ],
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

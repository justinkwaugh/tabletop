import {
    Phases1846,
    CorporateFinanceValidator,
    TrainDepot1846,
    inReceivership,
    MarketZoneColors1846,
    type EighteenFortySixProjectedState
} from '@tabletop/1846'
import { createPhaseChart, moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import BoomtownToken from './images/tokens/boomtown.svg'
import MailToken from './images/tokens/mail.svg'
import MeatPackingToken from './images/tokens/meat-packing.svg'
const StraightTilePair = [
    { definitionId: '18xx:9', rotation: 1 },
    { definitionId: '18xx:9', rotation: 1 }
] as const
export const Presentation1846: TitlePresentation<EighteenFortySixProjectedState> = {
    money: moneyFormat('$'),
    marketPoolId: 'open-market',
    privateTokens: {
        SC: { tileSymbol: 'port' },
        MAIL: { imageUrl: MailToken },
        LSL: { tiles: [{ definitionId: '18xx:14', rotation: 0 }] },
        MPC: { imageUrl: MeatPackingToken },
        MC: { tiles: StraightTilePair },
        'O&I': { tiles: StraightTilePair },
        LM: { tiles: StraightTilePair },
        'C&WI': { companyId: 'C&WI' },
        TBC: { terrain: 'mountain' },
        BT: { imageUrl: BoomtownToken }
    },
    marketCell: { width: 36, height: 96 },
    marketZones: [
        {
            color: MarketZoneColors1846.par,
            name: 'Par',
            banner: { label: 'Par values', shape: 'span' },
            description: 'A price a corporation may start at.'
        },
        {
            color: MarketZoneColors1846.tripleJump,
            name: 'Triple jump',
            banner: { label: 'Triple jump', shape: 'arrow' },
            description:
                'A payout of at least three times the share price moves the price three spaces right.'
        }
    ],
    trainColors: {
        '2': '#c9ab35',
        '4': '#4d9263',
        '3/5': '#4d9263',
        '5': '#a47447',
        '4/6': '#a47447',
        '6': '#747474',
        '7/8': '#747474'
    },
    phaseColors: { I: '#c9ab35', II: '#4d9263', III: '#a47447', IV: '#747474' },
    phaseChart: createPhaseChart({
        phases: Phases1846,
        depot: TrainDepot1846,
        rustPhases: { '2': 'III', '4': 'IV', '3/5': 'IV' },
        rustNotes: {
            '2': '2-trains become obsolete in phase III and run once more before removal. Any remaining 2-trains are removed immediately in phase IV.',
            '4': '4 and 3/5 trains become obsolete in phase IV and run once more before removal.',
            '3/5': '4 and 3/5 trains become obsolete in phase IV and run once more before removal.'
        },
        phaseNotes: {
            III: 'Independents and privates close, except corporation-owned Mail Contract. 2-trains run once more.',
            IV: '3/5 and 4-trains run once more; all 2-trains are removed.'
        },
        notes: [
            '3/5 and 4, 4/6 and 5, and 6 and 7/8 are paired faces of the same certificates.',
            'Two players: 5 / 5 / 3 / 4 depot certificates. Buying the last new final train ends after the next full operating set.'
        ]
    }),
    operatingSteps: [
        {
            label: 'Finance',
            states: ['CorporateFinance'],
            actions: ['CorporateFinance'],
            status: (_state, actions) => {
                const start = actions.findLastIndex(
                    (action) =>
                        action.type === 'StartOperatingTurn' || action.type === 'StartReceiverTurn'
                )
                const finance = actions
                    .slice(start + 1)
                    .findLast((action) => CorporateFinanceValidator.Check(action))
                return finance
                    ? finance.operation === 'pass'
                        ? 'Passed'
                        : `${finance.operation === 'issue' ? 'Issued' : 'Redeemed'} ${finance.shares}`
                    : undefined
            }
        },
        {
            label: 'Build',
            states: ['LayingTrack'],
            actions: [
                'LayTile',
                'PlaceStation',
                'BuildPrivateTrack',
                'PlaceCWIStation',
                'FinishTrack',
                'FinishStations'
            ],
            status: (_state, _actions, summaries) =>
                [summaries.track, summaries.station].filter(Boolean).join(' · ') || undefined
        },
        {
            label: 'Run',
            states: ['RunningTrains', 'RunningReceiver', 'RustingTrains'],
            actions: ['RunTrains'],
            status: (_state, _actions, summaries) => summaries.run
        },
        {
            label: 'Payout',
            states: ['DistributingEarnings'],
            actions: ['DistributeEarnings', 'SettleIndependent', 'SettleReceiver'],
            status: (_state, _actions, summaries) => summaries.payout
        },
        {
            label: 'Trains',
            states: ['BuyingTrains', 'FundingTrain', 'DiscardingTrains'],
            actions: ['BuyTrain', 'EmergencyBuyTrain', 'BuyReceiverTrain'],
            status: (_state, _actions, summaries) => summaries.trains
        }
    ],
    includedCompanyIds: ['MS', 'BIG4'],
    includedPortfolioCompanyIds: ['MS', 'BIG4'],
    openingRound: {
        name: 'Private company distribution',
        abbreviation: 'Draft',
        inProgress: (state) =>
            ['Drafting', 'RevealingDraft', 'BuyingOpeningCompanies'].includes(state.machineState)
    },
    companyFacts: (state, id) =>
        inReceivership(state, id) ? [{ label: 'Control', value: 'Receivership' }] : []
}

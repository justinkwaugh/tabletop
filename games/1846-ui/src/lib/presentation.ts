import {
    Phases1846,
    TrainDepot1846,
    inReceivership,
    MarketZoneColors1846,
    ownsTunnelBlasting,
    TunnelBlastingDiscount,
    TitleRules1846,
    type EighteenFortySixProjectedState,
    TitleRules1846
} from '@tabletop/1846'
import {
    constructionOperatingSteps,
    createPhaseChart,
    moneyFormat,
    type TitlePresentation
} from '@tabletop/18xx-ui'
import { CompanyNames1846 } from './companyPresentation.js'
import { mapPlacement1846 } from './history.js'
import BoomtownToken from './images/tokens/boomtown.svg'
import MailToken from './images/tokens/mail.svg'
import MeatPackingToken from './images/tokens/meat-packing.svg'
const StraightTilePair = [
    { definitionId: '18xx:9', rotation: 1 },
    { definitionId: '18xx:9', rotation: 1 }
] as const
export const Presentation1846: TitlePresentation<EighteenFortySixProjectedState> = {
    money: moneyFormat(TitleRules1846.currencySymbol),
    companyNames: CompanyNames1846,
    marketPoolId: 'open-market',
    historyMapPlacement: mapPlacement1846,
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
        BT: { imageUrl: BoomtownToken },
        MS: { companyId: 'MS' },
        BIG4: { companyId: 'BIG4' }
    },
    minorsAsPrivates: true,
    terrainDiscounts: (state, companyId) => ({
        mountain: ownsTunnelBlasting(state, companyId) ? TunnelBlastingDiscount : 0
    }),
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
    operatingSteps: constructionOperatingSteps(TitleRules1846, { payout: ['SettleIndependent'] }),
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

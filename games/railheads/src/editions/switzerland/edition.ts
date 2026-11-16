import { CompanyId, EditionId, InvestmentItem, SiteKind, type EditionDefinition } from '../types.js'
import { tollLayTrack } from '../standard.js'
import { SWITZERLAND_MAP } from './map.js'
import {
    creditSuisseDividend,
    loanLimit,
    swissCubeCost,
    swissTrackCost,
    totalSubsidiesPerShare
} from './rules.js'

// Every company starts with two loans, the $10 in its treasury.
const COMPANY_SUPPLY = { shares: 4, discs: 25, crossingCubes: 5, startingTreasury: 10 }

export const SWITZERLAND: EditionDefinition = {
    id: EditionId.Switzerland,
    name: 'Switzerland',
    companies: [
        {
            id: CompanyId.SNB,
            shortName: 'SNB',
            name: 'Schweizerische Nordbahn',
            homeSiteId: 'zurich',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.AB,
            shortName: 'AB',
            name: 'Appenzeller Bahn',
            homeSiteId: 'frauenfeld',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.PB,
            shortName: 'PB',
            name: 'Pilatus-Bahn',
            homeSiteId: 'alpnachstad',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.RHB,
            shortName: 'RhB',
            name: 'Rhätische Bahn',
            homeSiteId: 'winterthur',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.MOB,
            shortName: 'MOB',
            name: 'Montreux Oberland Bernois',
            homeSiteId: 'montreux',
            ...COMPANY_SUPPLY
        }
    ],
    // The charters left to right; the Start Player token sits on Red's (MOB) pile.
    initialAuctionOrder: [CompanyId.SNB, CompanyId.AB, CompanyId.PB, CompanyId.RHB, CompanyId.MOB],
    startPlayerCompany: CompanyId.MOB,
    map: SWITZERLAND_MAP,
    rounds: 4,
    // The rulebook's amounts, which it says replace the board's.
    startingCash: { 3: 30, 4: 23, 5: 18 },
    roundTimer: { 3: 18, 4: 15, 5: 15 },
    layTrack: tollLayTrack(true),
    trackCost: swissTrackCost,
    siteRevenue: { [SiteKind.City]: 5, [SiteKind.Town]: 3 },
    crossingCubeCost: swissCubeCost,
    siteCapacity: () => 3,
    industryInDemand: () => true,
    endBonusPerShare: totalSubsidiesPerShare,
    // Switzerland has no obsolescence; interest on loans lowers revenue instead.
    obsolescence: [],
    industryTokensPerType: 4,
    developmentTrackLength: 20,
    industryBonusPerSite: 0,
    investmentPartner: { item: InvestmentItem.CreditSuisse, minimum: 5, supply: 10 },
    loans: {
        starting: 2,
        amount: 5,
        repayment: 10,
        perAction: 2,
        maximum: 10,
        treasuryBelow: 20
    },
    loanDividend: creditSuisseDividend,
    loanLimit,
    tollValuePerStar: 2
}

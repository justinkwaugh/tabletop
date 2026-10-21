import { CompanyId, EditionId, SiteKind, type EditionDefinition } from '../types.js'
import { STANDARD_LAY_TRACK, STANDARD_OBSOLESCENCE } from '../standard.js'
import { MIDWEST_MAP } from './map.js'
import { demandEstablished, midwestTrackCost, stateSubsidyPerShare } from './rules.js'

const COMPANY_SUPPLY = { shares: 4, discs: 25, crossingCubes: 5, startingTreasury: 10 }

export const MIDWEST: EditionDefinition = {
    id: EditionId.Midwest,
    name: 'The Midwest',
    companies: [
        {
            id: CompanyId.PRR,
            shortName: 'PRR',
            name: 'Pennsylvania Railroad',
            homeSiteId: 'lincoln',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.BO,
            shortName: 'B&O',
            name: 'Baltimore & Ohio',
            homeSiteId: 'indianapolis',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.IC,
            shortName: 'IC',
            name: 'Illinois Central',
            homeSiteId: 'st-louis',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.ERIE,
            shortName: 'ERIE',
            name: 'Erie Railroad',
            homeSiteId: 'toledo',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.NYC,
            shortName: 'NYC',
            name: 'New York Central',
            homeSiteId: 'detroit',
            ...COMPANY_SUPPLY
        }
    ],
    // The rulebook auctions the charters right to left, starting with the NYC.
    initialAuctionOrder: [CompanyId.NYC, CompanyId.ERIE, CompanyId.IC, CompanyId.BO, CompanyId.PRR],
    startPlayerCompany: CompanyId.PRR,
    map: MIDWEST_MAP,
    rounds: 4,
    startingCash: { 3: 40, 4: 30, 5: 24 },
    roundTimer: { 3: 18, 4: 15, 5: 15 },
    layTrack: STANDARD_LAY_TRACK,
    trackCost: midwestTrackCost,
    siteRevenue: { [SiteKind.City]: 5, [SiteKind.Town]: 3 },
    crossingCubeCost: 1,
    siteCapacity: () => 3,
    industryInDemand: demandEstablished,
    endBonusPerShare: stateSubsidyPerShare,
    obsolescence: STANDARD_OBSOLESCENCE,
    industryTokensPerType: 4,
    developmentTrackLength: 20,
    industryBonusPerSite: 8
}

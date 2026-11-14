import { STANDARD_OBSOLESCENCE } from '../standard.js'
import { CompanyId, EditionId, SiteKind, type EditionDefinition } from '../types.js'
import { ENGLAND_MAP, Region } from './map.js'
import { ENGLAND_LAY_TRACK, runningRightsPerShare } from './rules.js'

const COMPANY_SUPPLY = { shares: 5, discs: 25, crossingCubes: 5, startingTreasury: 0 }

const REGIONS: Partial<Record<CompanyId, Region>> = {
    [CompanyId.LMS]: Region.Midlands,
    [CompanyId.LNER]: Region.East,
    [CompanyId.SR]: Region.South,
    [CompanyId.GWR]: Region.West
}

export const ENGLAND_WALES: EditionDefinition = {
    id: EditionId.EnglandWales,
    name: 'England & Wales',
    companies: [
        {
            id: CompanyId.LMS,
            shortName: 'LMS',
            name: 'London, Midland and Scottish Railway',
            homeSiteId: 'lancaster',
            regionId: Region.Midlands,
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.LNER,
            shortName: 'LNER',
            name: 'London and North Eastern Railway',
            homeSiteId: 'york',
            regionId: Region.East,
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.SR,
            shortName: 'SR',
            name: 'Southern Railway',
            homeSiteId: 'southampton',
            regionId: Region.South,
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.GWR,
            shortName: 'GWR',
            name: 'Great Western Railway',
            homeSiteId: 'cardiff',
            regionId: Region.West,
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.UERL,
            shortName: 'UERL',
            name: 'Underground Electric Railways',
            homeSiteId: 'london',
            ...COMPANY_SUPPLY,
            discs: 15
        }
    ],
    // The charters left to right; the First Player token sits on Black's (Underground) pile.
    initialAuctionOrder: [
        CompanyId.LMS,
        CompanyId.LNER,
        CompanyId.SR,
        CompanyId.GWR,
        CompanyId.UERL
    ],
    startPlayerCompany: CompanyId.UERL,
    map: ENGLAND_MAP,
    rounds: 4,
    startingCash: { 3: 40, 4: 30, 5: 24 },
    roundTimer: { 3: 18, 4: 15, 5: 15 },
    layTrack: ENGLAND_LAY_TRACK,
    // Priced by the Lay Track space instead; see ENGLAND_LAY_TRACK.
    trackCost: (_hexKind, discsBelow) => 2 * (discsBelow + 1),
    siteRevenue: { [SiteKind.City]: 5, [SiteKind.Town]: 3 },
    crossingCubeCost: () => 1,
    siteCapacity: (_round, siteId) => (siteId === 'london' ? 3 : 2),
    industryInDemand: () => true,
    endBonusPerShare: (context) => runningRightsPerShare(context, REGIONS[context.companyId]),
    obsolescence: STANDARD_OBSOLESCENCE,
    industryTokensPerType: 4,
    developmentTrackLength: 20,
    industryBonusPerSite: 6,
    tollValuePerStar: 0,
    underground: CompanyId.UERL
}

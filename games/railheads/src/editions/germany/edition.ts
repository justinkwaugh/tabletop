import { CompanyId, EditionId, HexKind, SiteKind, type EditionDefinition } from '../types.js'
import { STANDARD_LAY_TRACK, STANDARD_OBSOLESCENCE } from '../standard.js'
import { GERMANY_MAP } from './map.js'
import { railroadBonus } from './railroadBonus.js'

const COMPANY_SUPPLY = { shares: 4, discs: 25, crossingCubes: 5, startingTreasury: 0 }

export const GERMANY: EditionDefinition = {
    id: EditionId.Germany,
    name: 'Germany',
    companies: [
        {
            id: CompanyId.KPEV,
            shortName: 'K.P.E.V.',
            name: 'Königlich Preußische Eisenbahn-Verwaltung',
            homeSiteId: 'berlin',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.GBSE,
            shortName: 'G.B.S.E.',
            name: 'Großherzoglich Badische Staats-Eisenbahnen',
            homeSiteId: 'karlsruhe',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.KSSE,
            shortName: 'K.S.S.E.',
            name: 'Königlich Sächsische Staats-Eisenbahnen',
            homeSiteId: 'leipzig',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.KWSE,
            shortName: 'K.W.S.E.',
            name: 'Königlich Württembergische Staats-Eisenbahnen',
            homeSiteId: 'stuttgart',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.KBSB,
            shortName: 'K.B.S.B.',
            name: 'Königlich Bayerische Staats-Bahnen',
            homeSiteId: 'munchen',
            ...COMPANY_SUPPLY
        }
    ],
    // The rulebook auctions the K.P.E.V. first and the G.B.S.E. second, which is the charters'
    // left-to-right order on the board.
    initialAuctionOrder: [
        CompanyId.KPEV,
        CompanyId.GBSE,
        CompanyId.KSSE,
        CompanyId.KWSE,
        CompanyId.KBSB
    ],
    startPlayerCompany: CompanyId.KBSB,
    map: GERMANY_MAP,
    rounds: 4,
    startingCash: { 3: 40, 4: 30, 5: 24 },
    roundTimer: { 3: 18, 4: 15, 5: 15 },
    layTrack: STANDARD_LAY_TRACK,
    trackCost: (hexKind) => (hexKind === HexKind.Countryside ? 2 : 4),
    siteRevenue: { [SiteKind.City]: 5, [SiteKind.Town]: 3 },
    crossingCubeCost: () => 1,
    siteCapacity: (round) => round,
    industryInDemand: () => true,
    endBonusPerShare: ({ companyId, track, map }) => railroadBonus(companyId, track, map),
    obsolescence: STANDARD_OBSOLESCENCE,
    industryTokensPerType: 4,
    developmentTrackLength: 20,
    // The board's "$6 per industry site reached" with four sites a type, rather than the
    // rulebook's $10 with three.
    industryBonusPerSite: 6,
    tollValuePerStar: 0
}

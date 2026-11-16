import { CompanyId, EditionId, InvestmentItem, SiteKind, type EditionDefinition } from '../types.js'
import { tollLayTrack } from '../standard.js'
import { DENMARK_MAP } from './map.js'
import { danishCubeCost, danishTrackCost, wealthTax } from './rules.js'

const COMPANY_SUPPLY = { shares: 4, discs: 25, crossingCubes: 5, startingTreasury: 10 }

export const DENMARK: EditionDefinition = {
    id: EditionId.Denmark,
    name: 'Denmark',
    companies: [
        {
            id: CompanyId.SFJ,
            shortName: 'SFJ',
            name: 'Sydfynske Jernbaner',
            homeSiteId: 'nyborg',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.AAAJ,
            shortName: 'AaAJ',
            name: 'Aabenraa Amts Jernbaner',
            homeSiteId: 'aabenraa',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.AHB,
            shortName: 'AHB',
            name: 'Aalborg-Hvalpsund Jernbane',
            homeSiteId: 'aalborg',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.JFJ,
            shortName: 'JFJ',
            name: 'Jysk-Fynske Jernbaner',
            homeSiteId: 'ringkobing',
            ...COMPANY_SUPPLY
        },
        {
            id: CompanyId.DSJ,
            shortName: 'DSJ',
            name: 'Det Sjællandske Jernbaneselskab',
            homeSiteId: 'copenhagen',
            ...COMPANY_SUPPLY
        }
    ],
    // The charters left to right; Black's (DSJ) pile holds the Start Player token and a bond.
    initialAuctionOrder: [
        CompanyId.SFJ,
        CompanyId.AAAJ,
        CompanyId.AHB,
        CompanyId.JFJ,
        CompanyId.DSJ
    ],
    startPlayerCompany: CompanyId.DSJ,
    map: DENMARK_MAP,
    rounds: 4,
    startingCash: { 3: 40, 4: 30, 5: 24 },
    roundTimer: { 3: 18, 4: 15, 5: 15 },
    layTrack: tollLayTrack(false),
    trackCost: danishTrackCost,
    siteRevenue: { [SiteKind.City]: 5, [SiteKind.Town]: 3 },
    crossingCubeCost: danishCubeCost,
    siteCapacity: () => 3,
    industryInDemand: () => true,
    endBonusPerShare: () => 0,
    // The Revenue Track arrows: −2 from 11, −4 from 21, up to −10 from 51.
    obsolescence: [
        { from: 11, drop: 2 },
        { from: 21, drop: 4 },
        { from: 31, drop: 6 },
        { from: 41, drop: 8 },
        { from: 51, drop: 10 }
    ],
    industryTokensPerType: 4,
    developmentTrackLength: 20,
    industryBonusPerSite: 8,
    investmentPartner: { item: InvestmentItem.Bond, minimum: 1, supply: 13 },
    bondWithStartPlayer: true,
    wealthTax,
    tollValuePerStar: 2
}

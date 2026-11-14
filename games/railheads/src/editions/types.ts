import type { AxialCoordinates, HexOrientation } from '@tabletop/common'
import type { TrackHex } from '../model/components.js'
import type { EditionMap } from './editions.js'

export enum EditionId {
    Germany = 'Germany',
    Midwest = 'Midwest',
    Switzerland = 'Switzerland',
    Denmark = 'Denmark',
    EnglandWales = 'EnglandWales'
}

export enum CompanyId {
    KPEV = 'KPEV',
    GBSE = 'GBSE',
    KSSE = 'KSSE',
    KWSE = 'KWSE',
    KBSB = 'KBSB',
    PRR = 'PRR',
    BO = 'BO',
    IC = 'IC',
    ERIE = 'ERIE',
    NYC = 'NYC',
    SNB = 'SNB',
    AB = 'AB',
    PB = 'PB',
    RHB = 'RHB',
    MOB = 'MOB',
    SFJ = 'SFJ',
    AAAJ = 'AAAJ',
    AHB = 'AHB',
    JFJ = 'JFJ',
    DSJ = 'DSJ',
    LMS = 'LMS',
    LNER = 'LNER',
    SR = 'SR',
    GWR = 'GWR',
    UERL = 'UERL'
}

export enum Industry {
    Cloth = 'Cloth',
    Grain = 'Grain',
    Brick = 'Brick',
    Steel = 'Steel'
}

export const INDUSTRIES: readonly Industry[] = [
    Industry.Cloth,
    Industry.Grain,
    Industry.Brick,
    Industry.Steel
]

export enum SiteKind {
    City = 'City',
    Town = 'Town'
}

export enum HexKind {
    Countryside = 'Countryside',
    City = 'City',
    Town = 'Town',
    Industry = 'Industry',
    Hillside = 'Hillside',
    Tunnel = 'Tunnel',
    Bridge = 'Bridge'
}

// Hexes that take one disc and one crossing cube, unlike sites.
export const TRACK_HEX_KINDS: readonly HexKind[] = [
    HexKind.Countryside,
    HexKind.Hillside,
    HexKind.Tunnel,
    HexKind.Bridge
]

export function isTollKind(kind: HexKind): boolean {
    return kind === HexKind.Tunnel || kind === HexKind.Bridge
}

export enum ActionSpaceId {
    IssueShare = 'IssueShare',
    IndustryInvestment = 'IndustryInvestment',
    LayTrackIII = 'LayTrackIII',
    LayTrackII = 'LayTrackII',
    LayTrackI = 'LayTrackI'
}

export const ACTION_SPACES: readonly ActionSpaceId[] = [
    ActionSpaceId.IssueShare,
    ActionSpaceId.IndustryInvestment,
    ActionSpaceId.LayTrackIII,
    ActionSpaceId.LayTrackII,
    ActionSpaceId.LayTrackI
]

export type LayTrackRules = {
    maxCompanies: number
    placementsPerCompany: number
    requiresShare: boolean
    halfPriceWithoutShare: boolean
    allowsCrossingCubes: boolean
    tolls: number
    allowsLoans: boolean
    // England & Wales prices track by action space: this much a disc, times one more than the
    // discs beneath, and a flat price for a cube.
    discPrice?: number
    cubePrice?: number
    // Extra placements when every disc stays inside the company's designated region.
    regionPlacements?: number
}

export type CompanyDefinition = {
    id: CompanyId
    shortName: string
    name: string
    homeSiteId: string
    shares: number
    discs: number
    crossingCubes: number
    startingTreasury: number
    // England & Wales: the Big Four's designated region.
    regionId?: string
}

export type SiteDefinition = {
    id: string
    name: string
    kind: SiteKind
    hex: AxialCoordinates
    revenue?: number
}

// A bridge or tunnel. One disc on its first hex builds all of it, and its builder takes its
// toll chit.
export type TollDefinition = {
    id: string
    name: string
    kind: HexKind.Tunnel | HexKind.Bridge
    hexes: readonly AxialCoordinates[]
    stars: number
}

export type PeakDefinition = {
    name: string
    hex: AxialCoordinates
}

export type IndustrySiteDefinition = {
    industry: Industry
    hex: AxialCoordinates
}

export type RegionDefinition = {
    id: string
    name: string
    hexes: readonly AxialCoordinates[]
}

export type DemandAreaDefinition = {
    id: string
    name: string
    hex: AxialCoordinates
    industries: readonly Industry[]
}

export type MapDefinition = {
    orientation: HexOrientation
    countryside: readonly AxialCoordinates[]
    sites: readonly SiteDefinition[]
    industrySites: readonly IndustrySiteDefinition[]
    regions: readonly RegionDefinition[]
    demandAreas: readonly DemandAreaDefinition[]
    water: readonly AxialCoordinates[]
    hillside?: readonly AxialCoordinates[]
    tolls?: readonly TollDefinition[]
    peaks?: readonly PeakDefinition[]
}

// The second item an Industry Investment auctions beside the industry token.
export enum InvestmentItem {
    Industry = 'Industry',
    CreditSuisse = 'CreditSuisse',
    Bond = 'Bond'
}

export type InvestmentPartner = {
    item: InvestmentItem.CreditSuisse | InvestmentItem.Bond
    minimum: number
    supply: number
}

export type LoanRules = {
    starting: number
    amount: number
    repayment: number
    perAction: number
    maximum: number
    treasuryBelow: number
}

export type EndBonusContext = {
    companyId: CompanyId
    revenue: number
    loans: number
    track: readonly TrackHex[]
    map: EditionMap
}

export type ObsolescenceBand = { from: number; drop: number }

export type EditionDefinition = {
    id: EditionId
    name: string
    companies: readonly CompanyDefinition[]
    initialAuctionOrder: readonly CompanyId[]
    startPlayerCompany: CompanyId
    map: MapDefinition
    rounds: number
    startingCash: Readonly<Record<number, number>>
    roundTimer: Readonly<Record<number, number>>
    layTrack: Readonly<Record<LayTrackSpace, LayTrackRules>>
    trackCost: (hexKind: HexKind, discsBelow: number, span: number) => number
    siteRevenue: Readonly<Record<SiteKind, number>>
    crossingCubeCost: (hexKind: HexKind, span: number) => number
    siteCapacity: (round: number, siteId: string | undefined) => number
    industryInDemand: (
        industry: Industry,
        companyId: CompanyId,
        track: readonly TrackHex[],
        map: EditionMap
    ) => boolean
    endBonusPerShare: (context: EndBonusContext) => number
    obsolescence: readonly ObsolescenceBand[]
    industryTokensPerType: number
    developmentTrackLength: number
    industryBonusPerSite: number
    // Switzerland and Denmark auction a second item with each industry token, first-price.
    investmentPartner?: InvestmentPartner
    // Denmark puts a Government Bond with the Start Player token.
    bondWithStartPlayer?: boolean
    loans?: LoanRules
    // The Credit Suisse dividend each company adds per bank share, by its loans.
    loanDividend?: (loans: number) => number
    loanLimit?: (revenue: number) => number
    wealthTax?: (cash: number) => number
    tollValuePerStar: number
    // England & Wales: the Underground, whose coupling with a Big Four company pays a bonus.
    underground?: CompanyId
}

export type LayTrackSpace =
    ActionSpaceId.LayTrackI | ActionSpaceId.LayTrackII | ActionSpaceId.LayTrackIII

export function isLayTrackSpace(space: ActionSpaceId): space is LayTrackSpace {
    return (
        space === ActionSpaceId.LayTrackI ||
        space === ActionSpaceId.LayTrackII ||
        space === ActionSpaceId.LayTrackIII
    )
}

export function printedHex(col: number, row: number): AxialCoordinates {
    return { q: col, r: (row - col) / 2 }
}

export function printedPointyHex(row: number, col: number): AxialCoordinates {
    return { q: (col - row) / 2, r: row }
}

export function printedPointyRow(row: number, fromCol: number, toCol: number): AxialCoordinates[] {
    const hexes: AxialCoordinates[] = []
    for (let col = fromCol; col <= toCol; col += 2) {
        hexes.push(printedPointyHex(row, col))
    }
    return hexes
}

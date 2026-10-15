import type { AxialCoordinates } from '@tabletop/common'

export enum EditionId {
    Germany = 'Germany'
}

export enum CompanyId {
    KPEV = 'KPEV',
    GBSE = 'GBSE',
    KSSE = 'KSSE',
    KWSE = 'KWSE',
    KBSB = 'KBSB'
}

export enum Industry {
    Cloth = 'Cloth',
    Grain = 'Grain',
    Brick = 'Brick',
    Anvil = 'Anvil'
}

export const INDUSTRIES: readonly Industry[] = [
    Industry.Cloth,
    Industry.Grain,
    Industry.Brick,
    Industry.Anvil
]

export enum SiteKind {
    City = 'City',
    Town = 'Town'
}

export enum HexKind {
    Countryside = 'Countryside',
    City = 'City',
    Town = 'Town',
    Industry = 'Industry'
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
}

export type SiteDefinition = {
    id: string
    name: string
    kind: SiteKind
    hex: AxialCoordinates
}

export type IndustrySiteDefinition = {
    industry: Industry
    hex: AxialCoordinates
}

export type MapDefinition = {
    countrysideRowsByColumn: readonly (readonly number[])[]
    sites: readonly SiteDefinition[]
    industrySites: readonly IndustrySiteDefinition[]
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
    trackCost: (hexKind: HexKind, discsBelow: number) => number
    siteRevenue: Readonly<Record<SiteKind, number>>
    crossingCubeCost: number
    siteCapacity: (round: number, siteId: string | undefined) => number
    obsolescence: readonly ObsolescenceBand[]
    industryTokensPerType: number
    developmentTrackLength: number
    industryBonusPerSite: number
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

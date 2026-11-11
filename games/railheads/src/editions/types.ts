import type { AxialCoordinates, HexOrientation } from '@tabletop/common'
import type { TrackHex } from '../model/components.js'
import type { EditionMap } from './editions.js'

export enum EditionId {
    Germany = 'Germany',
    Midwest = 'Midwest'
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
    NYC = 'NYC'
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
    industryInDemand: (
        industry: Industry,
        companyId: CompanyId,
        track: readonly TrackHex[],
        map: EditionMap
    ) => boolean
    endBonusPerShare: (companyId: CompanyId, track: readonly TrackHex[], map: EditionMap) => number
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

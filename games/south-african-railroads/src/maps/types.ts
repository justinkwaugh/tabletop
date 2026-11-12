import type { Color, Point } from '@tabletop/common'

export enum MapId {
    SouthAfrica = 'SouthAfrica',
    TexasSpecial = 'TexasSpecial',
    Pennsylvania = 'Pennsylvania',
    Veld = 'Veld'
}

export enum RailroadId {
    CdFM = 'CdFM',
    CSAR = 'CSAR',
    NRC = 'NRC',
    CTRD = 'CTRD',
    CMRC = 'CMRC',
    ZASM = 'ZASM',
    MKT = 'MKT',
    MP = 'MP',
    SP = 'SP',
    GHH = 'GHH',
    SLSF = 'SLSF',
    TP = 'TP',
    CO = 'CO',
    BO = 'BO',
    NYC = 'NYC',
    BM = 'BM',
    PRR = 'PRR',
    PLE = 'PLE'
}

export enum SettlementKind {
    AgriculturalRailhead = 'AgriculturalRailhead',
    RailroadStation = 'RailroadStation',
    MercantileCenter = 'MercantileCenter',
    RailroadBase = 'RailroadBase',
    NaturalResource = 'NaturalResource',
    MetroArea = 'MetroArea'
}

export type SettlementDefinition = {
    id: string
    name: string
    kind: SettlementKind
    x: number
    y: number
}

export type LinkDefinition = {
    id: string
    ends: readonly [string, string]
    box: Point
    // A one-way link is built only from this end, by a railroad whose track already reaches it.
    oneWayFrom?: string
}

export type ExternalConnectionDefinition = {
    id: string
    name: string
    settlementId: string
    price: number
    value: number
    x: number
    y: number
}

export type RailroadDefinition = {
    id: RailroadId
    shortName: string
    name: string
    color: Color
    homeId: string
}

export type PointSettlementKind = Exclude<SettlementKind, SettlementKind.MetroArea>

// A one-off founding that joins a northern and a southern railroad whose track meets.
export type SpecialConnectionDefinition = {
    name: string
    northern: readonly RailroadId[]
    southern: readonly RailroadId[]
    cost: number
    // Added to each founding railroad's value for the final payoff only.
    valueBonus: number
}

// Links crossing a closed border cannot be built until this many dividends have been paid.
export type ClosedBorderDefinition = {
    opensAfterDividend: number
    linkIds: readonly string[]
}

// A round fought in wartime: track is dear, nothing but single links is built, the halted
// railroad builds nothing beyond its free first link, and more settlements are developed.
export type WarDefinition = {
    round: number
    linkCost: number
    haltedRailroad: RailroadId
    // Developments in one Develop Settlements action; all but the last are free.
    developments: number
}

// The railroad whose home is a metro area, auctioned once track reaches its home or the metro's
// income reaches `opensAtIncome`. Until its track meets another railroad's it pays
// `costMultiplier` times for track and connections. Every other railroad whose track first
// reaches its home pays a special dividend; so does this railroad when its track first meets
// another's, unless another railroad already reaches its home.
export type MetroRailroadDefinition = {
    railroadId: RailroadId
    opensAtIncome: number
    costMultiplier: number
}

export type MapDefinition = {
    id: MapId
    name: string
    railroads: readonly RailroadDefinition[]
    // Auctioned in this order at the start; every other railroad opens once track reaches its home.
    initialOffering: readonly RailroadId[]
    startPlayerRailroad: RailroadId
    // A double build may not run into and out of this settlement.
    doubleBuildBarrierId: string
    // The metro area Automatic Metro Development would raise next is developed without a
    // connection, and free as the second development.
    freeMetroDevelopment: boolean
    // Declining the paid second development, or leaving town, develops the first of these that
    // is not full.
    automaticDevelopment: readonly string[]
    // Develop Settlements may instead take a development cube back to the player's own area.
    leaveTown: boolean
    specialConnection?: SpecialConnectionDefinition
    settlements: readonly SettlementDefinition[]
    links: readonly LinkDefinition[]
    externalConnections: readonly ExternalConnectionDefinition[]
    settlementIncome: Readonly<Partial<Record<PointSettlementKind, readonly number[]>>>
    metroIncome: Readonly<Record<string, readonly number[]>>
    startingCash: Readonly<Record<number, number>>
    offerStockSlots: Readonly<Record<number, number>>
    // Dividends paid before the final payoff, which takes the place of the next and ends the game.
    dividendsBeforeFinal: number
    // Special dividends pay income ÷ 5 rounded up, rather than down.
    specialDividendsRoundUp: boolean
    // Each railroad's treasury starts with a die roll, doubled for these railroads.
    startingTreasuryRoll?: { doubled: readonly RailroadId[] }
    closedBorders?: readonly ClosedBorderDefinition[]
    war?: WarDefinition
    // The round in which every dividend and special dividend pays income ÷ 10, rounded down.
    recoveryRound?: number
    metroRailroad?: MetroRailroadDefinition
}

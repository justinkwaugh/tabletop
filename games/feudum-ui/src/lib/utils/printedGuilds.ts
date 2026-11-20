import type { BoundingBox, Color, Point } from '@tabletop/common'
import {
    AlchemistCartSpaces,
    AlchemistVesselSpace,
    ChickenSpaces,
    FarmerBarn,
    FarmerPurse,
    Goods,
    GuildTrackSpaces,
    Inventions,
    KnightMonsterIcons,
    KnightRowSections,
    MarketSpaces,
    MonkCoffer,
    MonkRosary,
    ScrollSpaces,
    VesselTypes,
    type Good,
    type GuildId,
    type GuildRank,
    type VesselType
} from '@tabletop/feudum'

/** Measured on the print, whose panels lie on their side: a print column is a game row. */

const West: readonly GuildId[] = ['alchemist', 'merchant', 'farmer']

/** R-1.3 The track's printed hexagons: the master's 5 nearest the panel's foot. */
const PrintedRanks: Record<GuildId, Record<GuildRank, Point>> = {
    alchemist: {
        master: { x: 80, y: 108 },
        journeyman: { x: 80, y: 222 },
        apprentice: { x: 80, y: 268 }
    },
    merchant: {
        master: { x: 83, y: 117 },
        journeyman: { x: 83, y: 232 },
        apprentice: { x: 83, y: 275 }
    },
    farmer: {
        master: { x: 83, y: 117 },
        journeyman: { x: 83, y: 232 },
        apprentice: { x: 83, y: 275 }
    },
    knight: {
        master: { x: 418, y: 232 },
        journeyman: { x: 418, y: 112 },
        apprentice: { x: 418, y: 75 }
    },
    noble: {
        master: { x: 418, y: 237 },
        journeyman: { x: 418, y: 115 },
        apprentice: { x: 418, y: 77 }
    },
    monk: {
        master: { x: 418, y: 240 },
        journeyman: { x: 418, y: 118 },
        apprentice: { x: 418, y: 77 }
    }
}

export function printedReeveOffset(guild: GuildId): Point {
    return { x: West.includes(guild) ? 40 : -40, y: 0 }
}

/** R-1.3 The market's printed bins: one column per good, its space 4 at the top and 1 at the foot. */
const MarketColumnX: Record<Good, number> = {
    saltpeter: 137,
    sulfur: 187,
    iron: 233,
    wood: 277,
    food: 323
}
const MarketRowY = (space: number) => 305 - (space - 1) * 43
const MarketBinTop = 150
const MarketBinBottom = 330

const CartPlaces: Record<Good, readonly Point[]> = {
    wood: [
        { x: 205, y: 189 },
        { x: 205, y: 216 },
        { x: 205, y: 242 }
    ],
    iron: [
        { x: 247, y: 189 },
        { x: 247, y: 216 },
        { x: 247, y: 242 }
    ],
    food: [
        { x: 289, y: 189 },
        { x: 289, y: 216 },
        { x: 289, y: 242 }
    ],
    sulfur: [
        { x: 352, y: 228 },
        { x: 377, y: 215 },
        { x: 377, y: 241 }
    ],
    saltpeter: [
        { x: 352, y: 305 },
        { x: 377, y: 294 },
        { x: 377, y: 321 }
    ]
}

const VesselSpace: Point = { x: 432, y: 62 }
export const PrintedVesselSize = 34

export const PrintedSizes = { cartGood: 26, seal: 40, knightMarker: 32 } as const
const VesselStep = 34

/** R-4.6.5 The printed inventions, a strip along the panel's foot, in the data's order. */
const InventionX = [97, 135, 167, 220, 252, 285]
const InventionY = 318

const RowColours: readonly Color[] = [...new Set(KnightRowSections.map(({ colour }) => colour))]

/** R-1.3 The Knight's printed hexagons: a colour's row runs down the panel, its column 1 at the top. */
const KnightColumnY = [18, 60, 97, 137, 175, 212]
const KnightRowX = (index: number) => 139 + index * 36
export const PrintedKnightCell = 36
const KnightLabelY = 252
const MonsterIconPlaces: Record<string, Point> = {
    'guild.knight.monster.behemoth': { x: 45, y: 30 },
    'guild.knight.monster.sea-serpent': { x: 45, y: 72 }
}

/** R-5-H1 The noble's printed scrolls, each seal space on its own roll. */
const ScrollPlaces: Record<string, Point> = {
    'guild.noble.scroll.r1c1': { x: 266, y: 63 },
    'guild.noble.scroll.r1c2': { x: 224, y: 63 },
    'guild.noble.scroll.r1c3': { x: 170, y: 67 },
    'guild.noble.scroll.r2c1': { x: 267, y: 113 },
    'guild.noble.scroll.r2c2': { x: 225, y: 118 },
    'guild.noble.scroll.r3c1': { x: 283, y: 170 }
}
export const PrintedScrollBox = { width: 42, height: 46 } as const

/** R-1.4-H3 The printed hens, one bead each, in the data's order. */
const ChickenPlaces: readonly Point[] = [
    { x: 370, y: 222 },
    { x: 432, y: 262 },
    { x: 362, y: 298 },
    { x: 446, y: 322 }
]

/** R-4.1 The barn's goods stand in five columns on the farmyard, a column's first token highest. */
const BarnColumnX = (index: number) => 160 + index * 38
const BarnTop = 222
export const PrintedBarnStackStep = 28
const BarnBoxBottom = 336
const BarnColumnWidth = 38

/** R-1.4-H3 The printed rosary's beads, from the monk's hand down the string. */
const RosaryString: readonly Point[] = [
    { x: 250, y: 87 },
    { x: 202, y: 105 },
    { x: 152, y: 122 },
    { x: 112, y: 160 },
    { x: 88, y: 207 },
    { x: 80, y: 260 },
    { x: 75, y: 314 }
]
const RosaryOverflowX = [160, 206, 252, 298, 344]
const RosaryOverflowY = [175, 221]

export const PrintedGuildSlots: ReadonlyMap<string, Point> = new Map<string, Point>([
    ...GuildTrackSpaces.map(({ id, guild, rank }): [string, Point] => [
        id,
        PrintedRanks[guild][rank]
    ]),
    ...MarketSpaces.map(({ id, good, space }): [string, Point] => [
        id,
        { x: MarketColumnX[good], y: MarketRowY(space) }
    ]),
    ...AlchemistCartSpaces.map(({ id, good, space }): [string, Point] => [
        id,
        CartPlaces[good][space - 1]
    ]),
    [AlchemistVesselSpace.id, VesselSpace],
    ...Inventions.map(({ id }, index): [string, Point] => [
        id,
        { x: InventionX[index], y: InventionY }
    ]),
    ...KnightRowSections.map(({ id, colour, firstColumn, lastColumn }): [string, Point] => [
        id,
        {
            x: printedKnightCell(colour, firstColumn).x,
            y: (KnightColumnY[firstColumn - 1] + KnightColumnY[lastColumn - 1]) / 2
        }
    ]),
    ...KnightMonsterIcons.map(({ id }): [string, Point] => [id, MonsterIconPlaces[id]]),
    ...ScrollSpaces.map(({ id }): [string, Point] => [id, ScrollPlaces[id]]),
    [FarmerBarn.id, { x: BarnColumnX(2), y: (BarnTop + BarnBoxBottom) / 2 }],
    [FarmerPurse.id, { x: 360, y: 35 }],
    ...ChickenSpaces.map(({ id }, index): [string, Point] => [id, ChickenPlaces[index]]),
    [MonkRosary.id, RosaryString[3]],
    [MonkCoffer.id, { x: 130, y: 60 }]
])

export function printedKnightCell(colour: Color, column: number): Point {
    return { x: KnightRowX(RowColours.indexOf(colour)), y: KnightColumnY[column - 1] }
}

export function printedKnightRowLabel(colour: Color): Point {
    return { x: printedKnightCell(colour, 1).x, y: KnightLabelY }
}

export function printedKnightRowBox(colour: Color): BoundingBox {
    const { x } = printedKnightCell(colour, 1)
    const top = KnightColumnY[0] - PrintedKnightCell / 2
    return {
        x: x - PrintedKnightCell / 2,
        y: top,
        width: PrintedKnightCell,
        height: KnightLabelY + 20 - top
    }
}

export function printedMonsterIconMarker(slot: Point): Point {
    return { x: slot.x + 39, y: slot.y }
}

export function printedMarketBinBox(good: Good): BoundingBox {
    const x = MarketColumnX[good]
    return { x: x - 22, y: MarketBinTop, width: 44, height: MarketBinBottom - MarketBinTop }
}

export function printedVesselForSale(vessel: VesselType): Point {
    return { x: VesselSpace.x, y: VesselSpace.y + (VesselTypes.indexOf(vessel) - 1) * VesselStep }
}

export function printedBarnColumn(good: Good): Point {
    return { x: BarnColumnX(Goods.indexOf(good)), y: BarnTop }
}

export function printedBarnColumnBox(good: Good): BoundingBox {
    const { x } = printedBarnColumn(good)
    const top = BarnTop - 21
    return {
        x: x - BarnColumnWidth / 2,
        y: top,
        width: BarnColumnWidth,
        height: BarnBoxBottom - top
    }
}

export function printedRosaryBead(index: number): Point {
    if (index < RosaryString.length) {
        return RosaryString[index]
    }
    const past = index - RosaryString.length
    const row = Math.floor(past / RosaryOverflowX.length) % RosaryOverflowY.length
    return { x: RosaryOverflowX[past % RosaryOverflowX.length], y: RosaryOverflowY[row] }
}

export const PrintedCounts = {
    rosary: { x: 175, y: 342 },
    coffer: { x: 130, y: 104 },
    purse: { x: 404, y: 42 },
    barn: { x: 236, y: 190 }
} as const

/** Contract, Desk layout: the faces are cut by `scripts/make-faces.mjs`, lying as on the board. */
export const PrintedFaces: Record<GuildId, Point> = {
    alchemist: { x: 241, y: 87.5 },
    merchant: { x: 236, y: 53.5 },
    farmer: { x: 236, y: 82.5 },
    knight: { x: 237.5, y: 279 },
    noble: { x: 232.5, y: 291.5 },
    monk: { x: 243, y: 260 }
}
export const PrintedFaceRadius = 53

export function printedFaceTurn(guild: GuildId): number {
    return West.includes(guild) ? 90 : -90
}

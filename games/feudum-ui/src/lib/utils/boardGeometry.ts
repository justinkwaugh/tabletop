import { Color, type BoundingBox, type Point } from '@tabletop/common'
import {
    AlchemistCartSpaces,
    AlchemistVesselSpace,
    ChickenSpaces,
    EpicVoyageTrack,
    EpochTrack,
    FarmerBarn,
    FarmerPurse,
    Goods,
    GuildIds,
    GuildRanks,
    GuildTrackSpaces,
    Inventions,
    KnightMonsterIcons,
    KnightRowSections,
    MarketSpaces,
    MilitaryServiceTrack,
    RegionTileChart,
    RouteMedia,
    Routes,
    ScrollSpaces,
    SealTotal,
    Spaces,
    VesselTypes,
    type Good,
    type GuildId,
    type RegionId,
    type RouteId,
    type RouteMedium,
    type SpaceId,
    type VesselType
} from '@tabletop/feudum'
import { assetUrl, guildPanelAsset } from '$lib/art/assetMap.js'
import {
    PrintedBarnStackStep,
    PrintedGuildSlots,
    PrintedScrollBox,
    PrintedVesselSize,
    printedBarnColumn,
    printedBarnColumnBox,
    printedKnightCell,
    printedKnightRowBox,
    printedKnightRowLabel,
    printedMarketBinBox,
    printedMonsterIconMarker,
    printedReeveOffset,
    printedRosaryBead,
    printedVesselForSale
} from './printedGuilds.js'

/**
 * The board in board units: one CSS pixel at scale 1. The surface has the printed board's
 * proportions, so a position here lands on the printed space when the map's art is shown, and on the
 * drawn terrain when it isn't. Authored once by hand; nothing is measured from a picture at run time.
 */
export const BoardWidth = 2500
export const BoardHeight = 953

/**
 * The map in the board's centre, the sky and the strip of stacks and barrels included. Contract, Desk
 * layout: the part of the board a desk draws, its guild areas behind the side buttons and its score
 * ring's band left out (its scores are the seat panels' and the zoom row's).
 */
export const MapArea = { x: 452, y: 60, width: 1598, height: 833 } as const
export const MapViewBox = `${MapArea.x} ${MapArea.y} ${MapArea.width} ${MapArea.height}`
/** Where the drawn terrain starts under the epoch sky. */
export const SkyBottom = 150

/** The frame a location disc is drawn in; the disc itself fills 84 % of it. */
export const DiscFrame = 72
/** The ring a space's pick draws round its disc. */
export const SpaceRingFrame = DiscFrame + 10
export const PawnSize = 46
export const MarkerSize = 26
export const ImmunitySealSize = 18
export const GoodSize = 22
export const LandscapeSize = 46
export const VesselSize = 36
export const MonsterSize = 54
/** R-4.1 Goods in the barn show one token each up to this many of a kind, then one with a count. */
export const GoodsShownSingly = 4
/** Up to this many pieces sit round a space; more show as a count chip. */
export const PieceSlotCount = 4

/** R-1.2.1 Where each space's disc goes on the printed board. */
export const SpaceCentres: Record<SpaceId, Point> = {
    'space.sea.1': { x: 578, y: 266 },
    'space.sea.2': { x: 504, y: 421 },
    'space.sea.3': { x: 972, y: 397 },
    'space.island.1': { x: 733, y: 386 },
    'space.island.2': { x: 866, y: 517 },
    'space.island.3': { x: 547, y: 606 },
    'space.island.4': { x: 702, y: 708 },
    'space.forest.1': { x: 825, y: 240 },
    'space.forest.2': { x: 1118, y: 272 },
    'space.forest.3': { x: 1327, y: 377 },
    'space.desert.1': { x: 1079, y: 559 },
    'space.desert.2': { x: 950, y: 735 },
    'space.desert.3': { x: 1182, y: 692 },
    'space.desert.4': { x: 1388, y: 575 },
    'space.desert.5': { x: 1561, y: 692 },
    'space.badlands.1': { x: 1429, y: 223 },
    'space.badlands.2': { x: 1650, y: 278 },
    'space.badlands.3': { x: 1532, y: 420 },
    'space.badlands.4': { x: 1729, y: 482 },
    'space.badlands.5': { x: 1801, y: 654 },
    'space.mountain.1': { x: 1922, y: 230 },
    'space.mountain.2': { x: 1987, y: 444 }
}

/** Where a space's contents and pieces stand, from its centre. */
const ContentOffsets = {
    pieceSlots: [
        { x: -56, y: -56 },
        { x: -19, y: -66 },
        { x: 19, y: -66 },
        { x: 56, y: -56 }
    ],
    countChip: { x: 0, y: -98 },
    ruler: { x: -46, y: 26 },
    subject: { x: -46, y: 54 },
    serf: { x: -20, y: 66 },
    landscape: { x: 56, y: 8 },
    plate: { x: 20, y: 36 },
    vessels: {
        ship: { x: -86, y: -8 },
        submersible: { x: -86, y: 28 },
        'flying-machine': { x: 98, y: -12 }
    },
    letters: { x: 0, y: 48 }
} as const

/**
 * A space against the map's edge keeps its contents on the map: mirrored, so what stands on one
 * side stands on the other, shifted along the edge, and with its vessels set where there is room.
 * Its markers keep to its disc.
 */
const EdgeFit: Partial<
    Record<
        SpaceId,
        {
            readonly mirror?: true
            readonly shift?: number
            readonly vessels?: Readonly<Record<VesselType, Point>>
        }
    >
> = {
    'space.sea.2': {
        shift: 8,
        vessels: {
            ship: { x: 100, y: -10 },
            submersible: { x: 100, y: 26 },
            'flying-machine': { x: 100, y: 62 }
        }
    },
    'space.mountain.1': { mirror: true },
    'space.mountain.2': {
        mirror: true,
        vessels: {
            ship: { x: -102, y: -44 },
            'flying-machine': { x: -102, y: -8 },
            submersible: { x: -102, y: 28 }
        }
    }
}

/** Where a space's goods plate starts, at its top corner nearest the disc, and which way it grows. */
export interface GoodsPlate {
    readonly at: Point
    readonly toward: 1 | -1
}

export const PlateGood = { size: 24, step: 34, pad: 6, height: 34 } as const

/** The centre of the plate slot for the good kind at `index`. */
export function plateSlot({ at, toward }: GoodsPlate, index: number): Point {
    const along = PlateGood.pad + PlateGood.step / 2 + index * PlateGood.step
    return { x: at.x + toward * along, y: at.y + PlateGood.height / 2 }
}

/** The plate holding `kinds` good kinds. */
export function plateBox({ at, toward }: GoodsPlate, kinds: number): BoundingBox {
    const width = kinds * PlateGood.step + 2 * PlateGood.pad
    return { x: toward > 0 ? at.x : at.x - width, y: at.y, width, height: PlateGood.height }
}

export interface SpaceGeometry {
    readonly centre: Point
    readonly pieceSlots: readonly Point[]
    readonly countChip: Point
    /** R-4.1.2 A ruler's marker below the disc on one side, a subject under it, a serf beside that. */
    readonly ruler: Point
    readonly subject: Point
    readonly serf: Point
    readonly landscape: Point
    /** R-1.1 The plate the goods stand on, one slot per kind present, packed from the first. */
    readonly plate: GoodsPlate
    readonly vessels: Readonly<Record<VesselType, Point>>
    readonly letters: Point
}

function spaceGeometryOf(spaceId: SpaceId): SpaceGeometry {
    const centre = SpaceCentres[spaceId]
    const fit = EdgeFit[spaceId]
    const at = ({ x, y }: Point, shift = fit?.shift ?? 0): Point => ({
        x: centre.x + x + shift,
        y: centre.y + y
    })
    const place = ({ x, y }: Point, shift?: number): Point =>
        at({ x: fit?.mirror ? -x : x, y }, shift)
    const vessels = fit?.vessels
    const vessel = (type: VesselType): Point =>
        vessels ? at(vessels[type]) : place(ContentOffsets.vessels[type])
    return {
        centre,
        pieceSlots: ContentOffsets.pieceSlots.map((slot) => place(slot)),
        countChip: place(ContentOffsets.countChip),
        ruler: place(ContentOffsets.ruler, 0),
        subject: place(ContentOffsets.subject, 0),
        serf: place(ContentOffsets.serf, 0),
        landscape: place(ContentOffsets.landscape),
        plate: { at: place(ContentOffsets.plate), toward: fit?.mirror ? -1 : 1 },
        vessels: {
            ship: vessel('ship'),
            submersible: vessel('submersible'),
            'flying-machine': vessel('flying-machine')
        },
        letters: place(ContentOffsets.letters)
    }
}

/** Every space's slots, by id. */
export const SpaceGeometries: ReadonlyMap<SpaceId, SpaceGeometry> = new Map(
    Spaces.map(({ id }) => [id, spaceGeometryOf(id)])
)

export function spaceGeometry(spaceId: SpaceId): SpaceGeometry {
    const geometry = SpaceGeometries.get(spaceId)
    if (!geometry) {
        throw new Error(`No position for ${spaceId}`)
    }
    return geometry
}

/**
 * R-1.2-H1 Each route's two control points; its ends are its spaces' centres. Fitted to the trail on
 * the printed board, one cubic each, so a river's bends are rounded off.
 */
export const RouteControls: Record<RouteId, readonly [Point, Point]> = {
    'route.road.forest-1--forest-2': [
        { x: 925, y: 214 },
        { x: 1008, y: 289 }
    ],
    'route.road.forest-2--forest-3': [
        { x: 1219, y: 264 },
        { x: 1206, y: 388 }
    ],
    'route.road.forest-2--badlands-1': [
        { x: 1239, y: 222 },
        { x: 1281, y: 272 }
    ],
    'route.road.forest-3--badlands-1': [
        { x: 1417, y: 396 },
        { x: 1463, y: 272 }
    ],
    'route.road.forest-3--desert-4': [
        { x: 1397, y: 421 },
        { x: 1322, y: 508 }
    ],
    'route.road.badlands-1--badlands-2': [
        { x: 1529, y: 189 },
        { x: 1562, y: 289 }
    ],
    'route.road.badlands-2--badlands-4': [
        { x: 1562, y: 330 },
        { x: 1769, y: 330 }
    ],
    'route.road.desert-3--desert-4': [
        { x: 1289, y: 698 },
        { x: 1289, y: 590 }
    ],
    'route.road.desert-1--desert-3': [
        { x: 1008, y: 661 },
        { x: 1099, y: 619 }
    ],
    'route.road.desert-2--desert-5': [
        { x: 1115, y: 830 },
        { x: 1343, y: 661 }
    ],
    'route.road.island-1--island-2': [
        { x: 702, y: 466 },
        { x: 847, y: 433 }
    ],
    'route.road.island-3--island-4': [
        { x: 603, y: 603 },
        { x: 578, y: 723 }
    ],
    'route.road.mountain-1--mountain-2': [
        { x: 2066, y: 247 },
        { x: 2025, y: 371 }
    ],
    'route.ship.sea-1--forest-1': [
        { x: 640, y: 206 },
        { x: 743, y: 214 }
    ],
    'route.ship.sea-1--sea-2': [
        { x: 537, y: 309 },
        { x: 545, y: 363 }
    ],
    'route.ship.sea-2--island-3': [
        { x: 470, y: 475 },
        { x: 475, y: 557 }
    ],
    'route.ship.island-3--desert-2': [
        { x: 425, y: 710 },
        { x: 702, y: 867 }
    ],
    'route.ship.desert-1--desert-2': [
        { x: 929, y: 537 },
        { x: 834, y: 685 }
    ],
    'route.ship.desert-1--badlands-3': [
        { x: 1177, y: 425 },
        { x: 1384, y: 491 }
    ],
    'route.ship.badlands-2--badlands-3': [
        { x: 1674, y: 355 },
        { x: 1570, y: 330 }
    ],
    'route.ship.badlands-2--mountain-2': [
        { x: 1860, y: 388 },
        { x: 1926, y: 165 }
    ],
    'route.submersible.sea-1--forest-1': [
        { x: 640, y: 206 },
        { x: 743, y: 214 }
    ],
    'route.submersible.island-1--forest-1': [
        { x: 764, y: 330 },
        { x: 785, y: 289 }
    ],
    'route.submersible.sea-1--sea-2': [
        { x: 537, y: 309 },
        { x: 545, y: 363 }
    ],
    'route.submersible.sea-2--island-3': [
        { x: 470, y: 475 },
        { x: 475, y: 557 }
    ],
    'route.submersible.sea-2--island-2': [
        { x: 578, y: 516 },
        { x: 743, y: 586 }
    ],
    'route.submersible.sea-3--island-1': [
        { x: 909, y: 396 },
        { x: 847, y: 371 }
    ],
    'route.submersible.sea-3--desert-1': [
        { x: 1000, y: 454 },
        { x: 1049, y: 495 }
    ],
    'route.submersible.desert-1--desert-2': [
        { x: 929, y: 537 },
        { x: 834, y: 685 }
    ],
    'route.submersible.island-3--desert-2': [
        { x: 425, y: 710 },
        { x: 702, y: 867 }
    ],
    'route.flying-machine.island-2--desert-1': [
        { x: 971, y: 425 },
        { x: 1095, y: 433 }
    ],
    'route.flying-machine.island-2--island-4': [
        { x: 785, y: 454 },
        { x: 710, y: 537 }
    ],
    'route.flying-machine.island-4--desert-2': [
        { x: 785, y: 619 },
        { x: 888, y: 628 }
    ],
    'route.flying-machine.desert-2--desert-5': [
        { x: 1074, y: 603 },
        { x: 1363, y: 603 }
    ],
    'route.flying-machine.desert-5--badlands-5': [
        { x: 1624, y: 603 },
        { x: 1727, y: 590 }
    ],
    'route.flying-machine.badlands-5--mountain-2': [
        { x: 1843, y: 537 },
        { x: 1880, y: 487 }
    ],
    'route.flying-machine.mountain-1--mountain-2': [
        { x: 1984, y: 247 },
        { x: 2000, y: 351 }
    ],
    'route.flying-machine.badlands-2--mountain-1': [
        { x: 1694, y: 181 },
        { x: 1818, y: 165 }
    ],
    'route.ferry.island-1--forest-2': [
        { x: 847, y: 322 },
        { x: 991, y: 330 }
    ],
    'route.ferry.desert-4--desert-5': [
        { x: 1397, y: 636 },
        { x: 1488, y: 628 }
    ],
    'route.ferry.badlands-4--mountain-2': [
        { x: 1818, y: 537 },
        { x: 1901, y: 421 }
    ]
}

/** Where two media join the same pair of spaces, how far apart their paths run. */
export const SideBySideSpacing = 12

export interface RoutePath {
    readonly from: Point
    readonly control1: Point
    readonly control2: Point
    readonly to: Point
}

/** The media joining this route's pair of spaces, in medium order. */
function mediaOfPair(a: SpaceId, b: SpaceId): readonly RouteMedium[] {
    return RouteMedia.filter((medium) =>
        Routes.some((route) => route.medium === medium && route.a === a && route.b === b)
    )
}

function routePathOf(routeId: RouteId): RoutePath {
    const route = Routes.find(({ id }) => id === routeId)
    if (!route) {
        throw new Error(`No route ${routeId}`)
    }
    const from = SpaceCentres[route.a]
    const to = SpaceCentres[route.b]
    const [control1, control2] = RouteControls[routeId]
    const media = mediaOfPair(route.a, route.b)
    const slot = media.indexOf(route.medium) - (media.length - 1) / 2
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const dx = (-(to.y - from.y) / length) * slot * SideBySideSpacing
    const dy = ((to.x - from.x) / length) * slot * SideBySideSpacing
    const shifted = ({ x, y }: Point): Point => ({ x: x + dx, y: y + dy })
    return {
        from: shifted(from),
        control1: shifted(control1),
        control2: shifted(control2),
        to: shifted(to)
    }
}

/** R-1.2.2 Every route's path, with its side-by-side offset applied. */
export const RoutePaths: ReadonlyMap<RouteId, RoutePath> = new Map(
    Routes.map(({ id }) => [id, routePathOf(id)])
)

export function routeD({ from, control1, control2, to }: RoutePath): string {
    const point = ({ x, y }: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`
    return `M${point(from)} C${point(control1)} ${point(control2)} ${point(to)}`
}

/** A point along a route's path, `t` from 0 to 1. */
export function routePointAt({ from, control1, control2, to }: RoutePath, t: number): Point {
    const u = 1 - t
    const along = (a: number, b: number, c: number, d: number) =>
        u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
    return {
        x: along(from.x, control1.x, control2.x, to.x),
        y: along(from.y, control1.y, control2.y, to.y)
    }
}

/**
 * The drawn terrain, schematic and our own: a rough outline round each region's spaces, in the
 * board's order. The sea is the ground under the rest and has no edge of its own but the map's.
 */
export const RegionOutlines: Record<RegionId, readonly (readonly Point[])[]> = {
    sea: [
        [
            { x: 452, y: SkyBottom },
            { x: 1000, y: SkyBottom },
            { x: 1040, y: 330 },
            { x: 1180, y: 430 },
            { x: 1010, y: 560 },
            { x: 880, y: 800 },
            { x: 680, y: 893 },
            { x: 452, y: 893 }
        ]
    ],
    island: [
        [
            { x: 650, y: 330 },
            { x: 780, y: 330 },
            { x: 880, y: 430 },
            { x: 960, y: 520 },
            { x: 900, y: 590 },
            { x: 800, y: 570 },
            { x: 690, y: 460 },
            { x: 640, y: 400 }
        ],
        [
            { x: 480, y: 570 },
            { x: 590, y: 545 },
            { x: 620, y: 640 },
            { x: 770, y: 670 },
            { x: 800, y: 750 },
            { x: 680, y: 780 },
            { x: 570, y: 720 },
            { x: 490, y: 650 }
        ]
    ],
    forest: [
        [
            { x: 740, y: SkyBottom },
            { x: 1400, y: SkyBottom },
            { x: 1400, y: 440 },
            { x: 1150, y: 480 },
            { x: 1020, y: 400 },
            { x: 1000, y: 320 },
            { x: 740, y: 300 }
        ]
    ],
    desert: [
        [
            { x: 1150, y: 480 },
            { x: 1400, y: 440 },
            { x: 1470, y: 470 },
            { x: 1620, y: 600 },
            { x: 1700, y: 760 },
            { x: 1880, y: 720 },
            { x: 2050, y: 720 },
            { x: 2050, y: 893 },
            { x: 680, y: 893 },
            { x: 880, y: 800 },
            { x: 1010, y: 560 }
        ]
    ],
    badlands: [
        [
            { x: 1400, y: SkyBottom },
            { x: 1800, y: SkyBottom },
            { x: 1840, y: 340 },
            { x: 1840, y: 500 },
            { x: 1880, y: 720 },
            { x: 1700, y: 760 },
            { x: 1620, y: 600 },
            { x: 1470, y: 470 },
            { x: 1400, y: 440 }
        ]
    ],
    mountain: [
        [
            { x: 1800, y: SkyBottom },
            { x: 2050, y: SkyBottom },
            { x: 2050, y: 720 },
            { x: 1880, y: 720 },
            { x: 1840, y: 500 },
            { x: 1840, y: 340 }
        ]
    ]
}

/** Where the drawn terrain names each region. */
export const RegionLabels: Record<RegionId, Point> = {
    sea: { x: 640, y: 180 },
    island: { x: 590, y: 800 },
    forest: { x: 1000, y: 370 },
    desert: { x: 1330, y: 740 },
    badlands: { x: 1560, y: 190 },
    mountain: { x: 1930, y: 640 }
}

/** The drawn river through the desert and badlands, under the routes. Schematic and our own. */
export const RiverPaths: readonly string[] = [
    'M1030 545 C1180 470 1380 500 1532 425 S1640 340 1760 340 S1960 320 2040 170',
    'M1950 300 C1930 360 1970 400 1985 440'
]

/** A closed outline with its corners rounded off: the path runs through each side's midpoint. */
export function outlineD(points: readonly Point[]): string {
    const middle = (a: Point, b: Point) => `${(a.x + b.x) / 2} ${(a.y + b.y) / 2}`
    const start = middle(points[points.length - 1], points[0])
    const curves = points.map((point, index) => {
        const next = points[(index + 1) % points.length]
        return `Q${point.x} ${point.y} ${middle(point, next)}`
    })
    return `M${start} ${curves.join(' ')} Z`
}

/** Whether a point is inside an outline's polygon. */
export function isInside({ x, y }: Point, outline: readonly Point[]): boolean {
    let inside = false
    outline.forEach((point, index) => {
        const previous = outline[(index + outline.length - 1) % outline.length]
        if (
            point.y > y !== previous.y > y &&
            x < ((previous.x - point.x) * (y - point.y)) / (previous.y - point.y) + point.x
        ) {
            inside = !inside
        }
    })
    return inside
}

/** One local box for every guild area, so the board and the bench draw the same component. */
export const GuildBox = { width: 500, height: 354 } as const
export const GuildViewBox = `0 0 ${GuildBox.width} ${GuildBox.height}`
/** A guild area's width on the board. */
export const GuildAreaWidth = 388
export const GuildAreaHeight = (GuildAreaWidth * GuildBox.height) / GuildBox.width
/** A guild area's width on the bench: fixed for legibility, whatever the board's scale. */
export const BenchAreaWidth = 440

/** R-1.2.3 Where each area stands on the board: the ring up the west edge and down the east. */
export const GuildAreas: Record<GuildId, Point> = {
    alchemist: { x: 62, y: 62 },
    merchant: { x: 62, y: 339 },
    farmer: { x: 62, y: 616 },
    knight: { x: 2051, y: 62 },
    noble: { x: 2051, y: 339 },
    monk: { x: 2051, y: 616 }
}

/** R-1.2.3 Alchemist, Merchant and Farmer stand up the west edge; the others down the east. */
export function westGuild(guild: GuildId): boolean {
    return GuildAreas[guild].x < MapArea.x
}

/** A side's three guilds down its edge of the board, as the bench and the strip order them. */
export function guildsDownSide(west: boolean): GuildId[] {
    return GuildIds.filter((guild) => westGuild(guild) === west).toSorted(
        (a, b) => GuildAreas[a].y - GuildAreas[b].y
    )
}

/**
 * R-1.2.3 The quarter turn, in degrees, that stands a guild area's print upright off the board: the
 * print lies on its side with its top toward the board's nearer edge, so a west print turns
 * clockwise and an east one counter-clockwise.
 */
export function uprightTurn(guild: GuildId): number {
    return westGuild(guild) ? 90 : -90
}

/** R-1.2.3 That turn about the area's centre, as a CSS transform of a box centred on its holder. */
export function uprightTransform(guild: GuildId): string {
    return `translate(-50%, -50%) rotate(${uprightTurn(guild)}deg)`
}

/** R-1.2.3 The guild area a point on the board lies in, if any. */
export function guildAreaAt({ x, y }: Point): GuildId | undefined {
    return GuildIds.find((guild) => {
        const area = GuildAreas[guild]
        return (
            x >= area.x &&
            x <= area.x + GuildAreaWidth &&
            y >= area.y &&
            y <= area.y + GuildAreaHeight
        )
    })
}

/**
 * R-1.2.3 Where a point of a guild area stands once the area is stood upright in `box` (its upright
 * box on the page, short side across): turned about the area's centre as the area is, and scaled to
 * the box.
 */
export function uprightPoint(guild: GuildId, point: Point, box: BoundingBox): Point {
    const area = GuildAreas[guild]
    const scale = box.height / GuildAreaWidth
    const across = (point.x - area.x - GuildAreaWidth / 2) * scale
    const down = (point.y - area.y - GuildAreaHeight / 2) * scale
    const turn = (uprightTurn(guild) * Math.PI) / 180
    return {
        x: box.x + box.width / 2 + across * Math.cos(turn) - down * Math.sin(turn),
        y: box.y + box.height / 2 + across * Math.sin(turn) + down * Math.cos(turn)
    }
}

/**
 * Contract, Guild standings: on a desk the six rails stand in one strip under the map, the West
 * guilds' then the East's, each in its area's order. In board units: `gap` above the strip and
 * between two rails, `divide` more between the West's and the East's. A rail's own drawing is
 * `drawing` pixels wide, and as tall as its heading and one line for each seat: the master's line
 * and the rest held, or with no master the heading's line holds the empty outline and every seat may
 * stand placeless under it, so every place fits however the places fall.
 */
export const StandingsStrip = {
    gap: 20,
    divide: 40,
    drawing: { width: 170, head: 36, line: 19 }
} as const
/** One rail's width in the strip, in board units: the strip runs the map's width. */
export const StripRailWidth =
    (MapArea.width - 5 * StandingsStrip.gap - StandingsStrip.divide) / GuildIds.length
/** Board units to a pixel of a strip rail's own drawing. */
export const StripRailScale = StripRailWidth / StandingsStrip.drawing.width

/** A strip rail's own drawing height at this many seats. */
export function stripRailDrawingHeight(seats: number): number {
    return StandingsStrip.drawing.head + StandingsStrip.drawing.line * seats
}

/** The strip's height under the board in board units, the gap above it included. */
export function standingsStripHeight(seats: number): number {
    return StandingsStrip.gap + stripRailDrawingHeight(seats) * StripRailScale
}

/** On a phone it stands over the map's inner edge, inside its column's view. */
export const RailOver = { width: 168, gap: 8, inset: 6, scale: 168 / 96 } as const

/** Where a guild's rail stands over the map on a phone, level with its area. */
export function railOverRect(guild: GuildId): BoundingBox {
    const x = westGuild(guild)
        ? MapArea.x + RailOver.gap
        : MapArea.x + MapArea.width - RailOver.gap - RailOver.width
    return {
        x,
        y: GuildAreas[guild].y + RailOver.inset,
        width: RailOver.width,
        height: GuildAreaHeight - 2 * RailOver.inset
    }
}

/**
 * A guild area stands on its printed panel when the folder holds the panel's file, else on our own
 * drawing; the two place its parts apart. Asked at each call, so whoever draws or animates an area
 * reads the same layout.
 */
export function guildPrinted(guild: GuildId): boolean {
    return assetUrl(guildPanelAsset(guild)) !== undefined
}

/** Sizes in a guild area's local units. */
/** R-4.7 A reeve stands at the influence marker's size, so its printed point reads. */
const GuildMarkerSize = 36

export const GuildSizes = {
    marker: GuildMarkerSize,
    reeve: GuildMarkerSize,
    good: 34,
    seal: 46,
    bead: 42,
    shilling: 42,
    vessel: 54,
    monster: 76
} as const

export const CrestCentre: Point = { x: 44, y: 38 }
export const RankRadius = 28
/** A reeve stands beside the rank's marker. */
export const ReeveOffset: Point = { x: 34, y: 18 }

export function reeveOffset(guild: GuildId): Point {
    return guildPrinted(guild) ? printedReeveOffset(guild) : ReeveOffset
}

/** R-1.3 One row per good; a slot is where the good's token stands in its cell. */
export const MarketCell = { width: 98, height: 46, tokenOffset: 28 } as const
export const CartCell = { width: 50, height: 46 } as const
export const KnightCell = 42
export const ScrollCell = { width: 130, height: 72 } as const
export const InventionCell = { width: 74, height: 76 } as const
export const VesselSpaceBox = { x: 254, y: 80, width: 236, height: 98 } as const
export const BarnBox = { x: 14, y: 80, width: 270, height: 264 } as const
export const CofferBox = { x: 370, y: 90, width: 120, height: 180 } as const
export const MonsterBox = { width: 140, height: 128 } as const
/** R-4.1 The first of a barn column's tokens stands highest, each further one below it. */
export const BarnStackStep = 40

const MarketSpacesPerBin = 4
const GoodRowY = (index: number) => 106 + index * 53
const MarketColumnX = (space: number) => 72 + (space - 1) * 104 + MarketCell.tokenOffset
const CartColumnX = (space: number) => 96 + (space - 1) * 56
const RankPlaces: Record<(typeof GuildRanks)[number], Point> = {
    apprentice: { x: 288, y: 32 },
    journeyman: { x: 364, y: 32 },
    master: { x: 440, y: 32 }
}

/** The goods in the Alchemist's rows, in the data's order. */
export const CartGoods: readonly Good[] = [...new Set(AlchemistCartSpaces.map(({ good }) => good))]

export function cartGoodRow(good: Good): Point {
    return { x: 34, y: GoodRowY(CartGoods.indexOf(good)) }
}

export function marketBinRow(good: Good): Point {
    return { x: 36, y: GoodRowY(Goods.indexOf(good)) }
}

/** A market bin's whole row, from its swatch to its last space; on the print, its column. */
export function marketBinBox(good: Good): BoundingBox {
    if (guildPrinted('merchant')) {
        return printedMarketBinBox(good)
    }
    const { x, y } = marketBinRow(good)
    const left = x - 22
    const right = MarketColumnX(MarketSpacesPerBin) - MarketCell.tokenOffset + MarketCell.width + 4
    return { x: left, y: y - 25, width: right - left, height: 50 }
}

/** R-1.3 The colours of the printed rows and barrels, in the data's order. */
export const PrintedColours: readonly Color[] = [
    ...new Set(KnightRowSections.map(({ colour }) => colour))
]

function drawnKnightCell(colour: Color, column: number): Point {
    return { x: 72 + (column - 1) * 48, y: 126 + PrintedColours.indexOf(colour) * 48 }
}

/** R-1.3 A Knight cell: a colour's row, a column 1 to 6. A row keeps its lane whoever plays. */
export function knightCell(colour: Color, column: number): Point {
    return guildPrinted('knight')
        ? printedKnightCell(colour, column)
        : drawnKnightCell(colour, column)
}

/** The disc naming a Knight row. */
export function knightRowLabel(colour: Color): Point {
    return guildPrinted('knight')
        ? printedKnightRowLabel(colour)
        : { x: 28, y: drawnKnightCell(colour, 1).y }
}

const KnightRowHeight = 46
const KnightRowEndGap = 4

/** A Knight row's whole lane, from its disc to its last cell. */
export function knightRowBox(colour: Color): BoundingBox {
    if (guildPrinted('knight')) {
        return printedKnightRowBox(colour)
    }
    const { x: left, y } = knightRowLabel(colour)
    const right = drawnKnightCell(colour, 6).x + KnightCell / 2 + KnightRowEndGap
    const start = left - 22
    return { x: start, y: y - KnightRowHeight / 2, width: right - start, height: KnightRowHeight }
}

/** R-1.3 The middle of a section's columns, above the rows or in any one of them. */
export function knightSectionMiddle(firstColumn: number, lastColumn: number) {
    return drawnKnightCell(PrintedColours[0], (firstColumn + lastColumn) / 2).x
}
export const KnightSectionHeaderY = 88

/** R-5-H1 Rows of 3, 2, 1, left-aligned. */
const scrollPlace = (row: number, column: number): Point => ({
    x: 110 + (column - 1) * 150,
    y: 128 + (row - 1) * 88
})

const inventionPlace = (index: number): Point => ({
    x: 291 + (index % 3) * 80,
    y: 228 + Math.floor(index / 3) * 80
})

/** R-1.4-H3 Two chickens to a row; the spaces come from the provisional registry through the data. */
const chickenPlace = (space: number): Point => ({
    x: 340 + ((space - 1) % 2) * 100,
    y: 124 + Math.floor((space - 1) / 2) * 80
})

const BeadsPerRosaryRow = 6

/** R-1.4-H3 The rosary is unlimited for now, so a place for every seal in the box. */
export function rosaryBead(index: number): Point {
    if (guildPrinted('monk')) {
        return printedRosaryBead(index)
    }
    return {
        x: 44 + (index % BeadsPerRosaryRow) * 58,
        y: 130 + Math.floor(index / BeadsPerRosaryRow) * 62
    }
}

export const RosaryPlaces = SealTotal
export const RosaryTotalAt: Point = { x: 190, y: 330 }

/**
 * Every guild grid space, part and track space by the data's id, in the guild's local units: a
 * market or cart space's token, a section's middle, the centre of a part. The bench lights what it
 * offers from this table, as the board draws from it.
 */
export const GuildSlots: ReadonlyMap<string, Point> = new Map<string, Point>([
    ...GuildTrackSpaces.map(({ id, rank }): [string, Point] => [id, RankPlaces[rank]]),
    ...MarketSpaces.map(({ id, good, space }): [string, Point] => [
        id,
        { x: MarketColumnX(space), y: marketBinRow(good).y }
    ]),
    ...AlchemistCartSpaces.map(({ id, good, space }): [string, Point] => [
        id,
        { x: CartColumnX(space), y: cartGoodRow(good).y }
    ]),
    [AlchemistVesselSpace.id, { x: 372, y: 129 }],
    ...Inventions.map(({ id }, index): [string, Point] => [id, inventionPlace(index)]),
    ...KnightRowSections.map(({ id, colour, firstColumn, lastColumn }): [string, Point] => [
        id,
        { x: knightSectionMiddle(firstColumn, lastColumn), y: drawnKnightCell(colour, 1).y }
    ]),
    ...KnightMonsterIcons.map(({ id }, index): [string, Point] => [
        id,
        { x: 420, y: 144 + index * 136 }
    ]),
    ...ScrollSpaces.map(({ id, row, column }): [string, Point] => [id, scrollPlace(row, column)]),
    [FarmerBarn.id, { x: BarnBox.x + BarnBox.width / 2, y: BarnBox.y + BarnBox.height / 2 }],
    [FarmerPurse.id, { x: 390, y: 300 }],
    ...ChickenSpaces.map(({ id, space }): [string, Point] => [id, chickenPlace(space)]),
    ['guild.monk.rosary', { x: 190, y: 192 }],
    ['guild.monk.coffer', { x: 430, y: 180 }]
])

/** Which guild's area holds a slot, so its layout can be asked. */
const SlotGuilds: ReadonlyMap<string, GuildId> = new Map<string, GuildId>([
    ...GuildTrackSpaces.map(({ id, guild }): [string, GuildId] => [id, guild]),
    ...MarketSpaces.map(({ id }): [string, GuildId] => [id, 'merchant']),
    ...AlchemistCartSpaces.map(({ id }): [string, GuildId] => [id, 'alchemist']),
    [AlchemistVesselSpace.id, 'alchemist'],
    ...Inventions.map(({ id }): [string, GuildId] => [id, 'alchemist']),
    ...KnightRowSections.map(({ id }): [string, GuildId] => [id, 'knight']),
    ...KnightMonsterIcons.map(({ id }): [string, GuildId] => [id, 'knight']),
    ...ScrollSpaces.map(({ id }): [string, GuildId] => [id, 'noble']),
    [FarmerBarn.id, 'farmer'],
    [FarmerPurse.id, 'farmer'],
    ...ChickenSpaces.map(({ id }): [string, GuildId] => [id, 'farmer']),
    ['guild.monk.rosary', 'monk'],
    ['guild.monk.coffer', 'monk']
])

/** A slot's place in its area's layout: on the printed panel when the file is there. */
export function guildSlot(id: string): Point {
    const guild = SlotGuilds.get(id)
    const slot = (guild && guildPrinted(guild) ? PrintedGuildSlots : GuildSlots).get(id)
    if (!slot) {
        throw new Error(`No position for ${id}`)
    }
    return slot
}

const DrawnScrollBox = { width: ScrollCell.width + 6, height: ScrollCell.height + 6 } as const

/** A scroll space's whole roll. */
export function scrollBox(id: string): BoundingBox {
    const { width, height } = guildPrinted('noble') ? PrintedScrollBox : DrawnScrollBox
    const { x, y } = guildSlot(id)
    return { x: x - width / 2, y: y - height / 2, width, height }
}

/** R-4.2.4 A monster icon's controller: its marker beside the beast. */
export function monsterIconMarker(id: string): Point {
    const slot = guildSlot(id)
    return guildPrinted('knight')
        ? printedMonsterIconMarker(slot)
        : { x: slot.x + 46, y: slot.y - 40 }
}

/** The size a vessel for sale stands at: the printed glass box is narrow. */
export function vesselForSaleSize(): number {
    return guildPrinted('alchemist') ? PrintedVesselSize : GuildSizes.vessel
}

/** R-4.5.3 A vessel for sale of each type, covering the ferry symbol. */
export function vesselForSale(vessel: VesselType): Point {
    if (guildPrinted('alchemist')) {
        return printedVesselForSale(vessel)
    }
    const { x, y } = guildSlot(AlchemistVesselSpace.id)
    return { x: x + (VesselTypes.indexOf(vessel) - 1) * 76, y }
}

const DrawnVesselBox = 72

/** The press around a vessel for sale. */
export function vesselForSaleBox(vessel: VesselType): BoundingBox {
    const size = guildPrinted('alchemist') ? PrintedVesselSize : DrawnVesselBox
    const { x, y } = vesselForSale(vessel)
    return { x: x - size / 2, y: y - size / 2, width: size, height: size }
}

/** R-4.1 A barn column's token `index` from its first, the first highest. */
export function barnTokenAt(good: Good, index: number): Point {
    const { x, y } = barnColumn(good)
    const step = guildPrinted('farmer') ? PrintedBarnStackStep : BarnStackStep
    return { x, y: y + index * step }
}

const BarnBottomGap = 6
const BarnColumnPress = 48

/** R-4.6.1 A kind of good's whole column in the barn. */
export function barnColumnBox(good: Good): BoundingBox {
    if (guildPrinted('farmer')) {
        return printedBarnColumnBox(good)
    }
    const { x, y } = barnColumn(good)
    const top = y - GuildSizes.good / 2 - 4
    return {
        x: x - BarnColumnPress / 2,
        y: top,
        width: BarnColumnPress,
        height: BarnBox.y + BarnBox.height - BarnBottomGap - top
    }
}

/** A good's column in the barn: its first token. */
export function barnColumn(good: Good): Point {
    if (guildPrinted('farmer')) {
        return printedBarnColumn(good)
    }
    return { x: BarnBox.x + 36 + Goods.indexOf(good) * 50, y: BarnBox.y + 66 }
}

/** The score ring's band round the board's edge. */
export const ScoreBand = 60
/** A score disc is nearly the band's width, so it reads at desk size. */
export const ScoreDiscSize = 40
/** Discs sharing a space overlap by half along the track. */
const ScoreFanStep = ScoreDiscSize / 2
/** R-1.2.5 The spaces from each corner to the next: 0 bottom-left, 20, 75, 95 at the others. */
const ScoreRun = [
    { side: 'left', spaces: 20 },
    { side: 'top', spaces: 55 },
    { side: 'right', spaces: 20 },
    { side: 'bottom', spaces: 55 }
] as const

export type ScoreSide = (typeof ScoreRun)[number]['side']

export interface ScoreSpace {
    readonly space: number
    readonly centre: Point
    readonly width: number
    readonly height: number
    readonly side: ScoreSide
    readonly corner: boolean
}

function scoreSpacesOf(): readonly ScoreSpace[] {
    const inset = ScoreBand / 2
    const corners: readonly Point[] = [
        { x: inset, y: BoardHeight - inset },
        { x: inset, y: inset },
        { x: BoardWidth - inset, y: inset },
        { x: BoardWidth - inset, y: BoardHeight - inset }
    ]
    return ScoreRun.flatMap(({ side, spaces }, sideIndex) => {
        const from = corners[sideIndex]
        const to = corners[(sideIndex + 1) % corners.length]
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        const cell = (length - ScoreBand) / (spaces - 1)
        const upright = side === 'left' || side === 'right'
        const before = ScoreRun.slice(0, sideIndex).reduce((sum, run) => sum + run.spaces, 0)
        return Array.from({ length: spaces }, (_, step) => {
            const along = step === 0 ? 0 : inset + (step - 0.5) * cell
            const corner = step === 0
            return {
                space: before + step,
                centre: {
                    x: from.x + ((to.x - from.x) * along) / length,
                    y: from.y + ((to.y - from.y) * along) / length
                },
                width: corner || upright ? ScoreBand : cell,
                height: corner || !upright ? ScoreBand : cell,
                side,
                corner
            }
        })
    })
}

/** R-1.2.5 The 150 spaces, 0 to 149, up the west edge, along the top, down the east, back along the bottom. */
export const ScoreSpaces: readonly ScoreSpace[] = scoreSpacesOf()

const InwardBySide: Record<ScoreSide, Point> = {
    left: { x: 1, y: 0 },
    top: { x: 0, y: 1 },
    right: { x: -1, y: 0 },
    bottom: { x: 0, y: -1 }
}

/** The way the track runs along each side, from 0 upwards. */
const AlongBySide: Record<ScoreSide, Point> = {
    left: { x: 0, y: -1 },
    top: { x: 1, y: 0 },
    right: { x: 0, y: 1 },
    bottom: { x: -1, y: 0 }
}

/**
 * R-1.2.5 The index-th of count discs on one space: alone it stands on the space; sharing it
 * fans along the track, centred on the space, overlapping the next by half. On a corner the fan
 * runs from the corner along the track, so it stays on the board.
 */
export function scoreDiscAt(space: number, index = 0, count = 1): Point {
    const { centre, side, corner } = ScoreSpaces[space]
    const along = corner ? index * ScoreFanStep : fanOffset(index, count, ScoreFanStep)
    const way = AlongBySide[side]
    return { x: centre.x + way.x * along, y: centre.y + way.y * along }
}

/** Where a disc's "+150" chip stands, from the disc: towards the board, clear of the disc. */
export function scoreChipOffset(space: number): Point {
    const inward = InwardBySide[ScoreSpaces[space].side]
    return { x: inward.x * 46, y: inward.y * 34 }
}

/** Discs sharing a track space stand side by side, centred on it. */
export function fanOffset(index: number, count: number, step: number): number {
    return (index - (count - 1) / 2) * step
}

export const TrackDiscSize = 22
export const VoyageFanStep = 16
export const ServiceFanStep = 14

/** R-3.7.5 The epic voyage, up the mountains to the monastery; fitted to the print. */
const VoyageCentres: readonly Point[] = [
    { x: 1604, y: 143 },
    { x: 1653, y: 123 },
    { x: 1760, y: 125 },
    { x: 1810, y: 115 },
    { x: 1915, y: 125 },
    { x: 1965, y: 109 },
    { x: 2013, y: 80 }
]

/** R-4.9.2 The military service spaces on the shore; fitted to the print. */
const ServiceCentres: readonly Point[] = [
    { x: 690, y: 871 },
    { x: 788, y: 859 },
    { x: 878, y: 839 }
]

/** R-4.11 Where the epoch marker stands on each sunray, over its numeral. */
const RayCentres: readonly Point[] = [
    { x: 863, y: 167 },
    { x: 893, y: 147 },
    { x: 943, y: 137 },
    { x: 997, y: 147 },
    { x: 1027, y: 173 }
]

/** R-4.12 Where a sunray shows its dawn's marks, further out along the ray. */
const RayMarks: readonly Point[] = [
    { x: 778, y: 123 },
    { x: 855, y: 93 },
    { x: 945, y: 80 },
    { x: 1031, y: 83 },
    { x: 1094, y: 137 }
]

/** The sunrays' middle, for the drawn sky. */
export const SunCentre: Point = { x: 945, y: 186 }

const ChartRowY = [797, 816, 836, 854, 874]

/** R-4.3.2 The region tile chart's box, and each row of it. */
export const TileChart = {
    x: 1600,
    y: 766,
    width: 90,
    height: 120,
    headerY: 778,
    columns: [1616, 1640, 1662, 1682]
} as const

function placedBy<T extends { readonly id: string }>(
    rows: readonly T[],
    place: (row: T, index: number) => Point
): ReadonlyMap<string, Point> {
    return new Map(rows.map((row, index) => [row.id, place(row, index)]))
}

/** Each track space by the data's id, in board units. */
export const VoyageSpaces = placedBy(EpicVoyageTrack, (_, index) => VoyageCentres[index])
export const ServiceSpaces = placedBy(MilitaryServiceTrack, (_, index) => ServiceCentres[index])
export const EpochRays = placedBy(EpochTrack, (_, index) => RayCentres[index])
export const EpochRayMarks = placedBy(EpochTrack, (_, index) => RayMarks[index])
export const TileChartRows = placedBy(RegionTileChart, (_, index) => ({
    x: TileChart.columns[0],
    y: ChartRowY[index]
}))

export function trackPlace(table: ReadonlyMap<string, Point>, id: string): Point {
    const place = table.get(id)
    if (!place) {
        throw new Error(`No position for ${id}`)
    }
    return place
}

/** R-4.3.1 Each region's stack on the strip below the map. */
export const StackCentres: Record<RegionId, Point> = {
    sea: { x: 1034, y: 856 },
    island: { x: 1116, y: 856 },
    forest: { x: 1198, y: 856 },
    desert: { x: 1304, y: 856 },
    badlands: { x: 1387, y: 856 },
    mountain: { x: 1470, y: 856 }
}
export const StackSize = 72
export const StackCountOffset: Point = { x: 30, y: -32 }

/** R-4.11.1 The progress die, beside the stacks. */
export const DieCentre: Point = { x: 966, y: 866 }
export const DieSize = 44

/** R-4.10.2 One barrel per printed colour; each seat's stands at its own colour. */
export const BarrelCentres: Partial<Record<Color, Point>> = {
    [Color.Blue]: { x: 1784, y: 802 },
    [Color.Yellow]: { x: 1784, y: 862 },
    [Color.Red]: { x: 1957, y: 802 },
    [Color.Purple]: { x: 1917, y: 862 },
    [Color.Green]: { x: 1990, y: 862 }
}
export const BarrelSize = 54
export const BarrelSulfurSize = 16
/** The seat's disc on the barrel head, and each barrel sulfur beneath it. */
export const BarrelDisc: Point = { x: 0, y: -12 }
export const BarrelSulfur: readonly Point[] = [
    { x: -16, y: 10 },
    { x: 0, y: 10 },
    { x: 16, y: 10 }
]

export function barrelCentre(colour: Color): Point {
    const centre = BarrelCentres[colour]
    if (!centre) {
        throw new Error(`No barrel for ${colour}`)
    }
    return centre
}

/**
 * Contract, Supply: the general supply has no place on the board; it opens as a card from the Supply
 * button over the board's lower-left corner. A piece that leaves or reaches the supply (the writ
 * deck, the seal pile, the haversack) flies from or to this corner, inside the board.
 */
export const SupplyCorner: Point = { x: 60, y: BoardHeight - 60 }
export const SupplyToken = 34

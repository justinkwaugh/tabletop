import {
    RouteMedia,
    Routes,
    Spaces,
    type RegionId,
    type RouteId,
    type RouteMedium,
    type SpaceId,
    type VesselType
} from '@tabletop/feudum'

/**
 * The board in board units: one CSS pixel at scale 1. The surface has the printed board's
 * proportions, so a position here lands on the printed space when the map's art is shown, and on the
 * drawn terrain when it isn't. Authored once by hand; nothing is measured from a picture at run time.
 */
export interface Point {
    readonly x: number
    readonly y: number
}

export const BoardWidth = 2500
export const BoardHeight = 953
/** The deck, haversack and supply counts, below the board. */
export const MarginHeight = 150

/** The map in the board's centre, the sky and the strip of stacks and barrels included. */
export const MapArea = { x: 452, y: 60, width: 1598, height: 833 } as const
export const MapViewBox = `${MapArea.x} ${MapArea.y} ${MapArea.width} ${MapArea.height}`
/** Where the drawn terrain starts under the epoch sky. */
export const SkyBottom = 150

/** The frame a location disc is drawn in; the disc itself fills 84 % of it. */
export const DiscFrame = 72
export const PawnSize = 46
export const MarkerSize = 26
export const ImmunitySealSize = 18
export const GoodSize = 22
export const LandscapeSize = 46
export const VesselSize = 36
export const MonsterSize = 54
/** R-4.1 Goods show one token each up to this many of a kind, then one token with a count. */
export const GoodsShownSingly = 4
/** Up to this many pieces sit round a space; more show as a count chip. */
export const PieceSlotCount = 4
/** How far each further token of a kind stands below the one before it. */
export const GoodStackStep = 5

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
        { x: -50, y: -24 },
        { x: -22, y: -56 },
        { x: 22, y: -56 },
        { x: 50, y: -24 }
    ],
    countChip: { x: 52, y: -60 },
    ruler: { x: -13, y: -14 },
    subject: { x: 13, y: -14 },
    serf: { x: 0, y: 13 },
    landscape: { x: -30, y: 62 },
    goods: [
        { x: 8, y: 50 },
        { x: 31, y: 50 },
        { x: 54, y: 50 },
        { x: 77, y: 50 },
        { x: 100, y: 50 }
    ],
    vessels: {
        ship: { x: -62, y: 4 },
        submersible: { x: 62, y: 4 },
        'flying-machine': { x: 62, y: 24 }
    },
    letters: { x: -46, y: 26 }
} as const

/** A space against the map's edge keeps its contents on the map. */
const EdgeFit: Partial<Record<SpaceId, { readonly mirror?: true; readonly shift: number }>> = {
    'space.sea.2': { shift: 20 },
    'space.mountain.2': { mirror: true, shift: -18 }
}

export interface SpaceGeometry {
    readonly centre: Point
    readonly pieceSlots: readonly Point[]
    readonly countChip: Point
    /** R-4.1.2 A ruler's marker, a subject beside it, a serf below. */
    readonly ruler: Point
    readonly subject: Point
    readonly serf: Point
    readonly landscape: Point
    /** One column per good kind present, packed from the first. */
    readonly goods: readonly Point[]
    readonly vessels: Readonly<Record<VesselType, Point>>
    readonly letters: Point
}

function spaceGeometryOf(spaceId: SpaceId): SpaceGeometry {
    const centre = SpaceCentres[spaceId]
    const fit = EdgeFit[spaceId]
    const place = ({ x, y }: Point): Point => ({
        x: centre.x + (fit?.mirror ? -x : x) + (fit?.shift ?? 0),
        y: centre.y + y
    })
    return {
        centre,
        pieceSlots: ContentOffsets.pieceSlots.map(place),
        countChip: place(ContentOffsets.countChip),
        ruler: { x: centre.x + ContentOffsets.ruler.x, y: centre.y + ContentOffsets.ruler.y },
        subject: { x: centre.x + ContentOffsets.subject.x, y: centre.y + ContentOffsets.subject.y },
        serf: { x: centre.x + ContentOffsets.serf.x, y: centre.y + ContentOffsets.serf.y },
        landscape: place(ContentOffsets.landscape),
        goods: ContentOffsets.goods.map(place),
        vessels: {
            ship: place(ContentOffsets.vessels.ship),
            submersible: place(ContentOffsets.vessels.submersible),
            'flying-machine': place(ContentOffsets.vessels['flying-machine'])
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
    forest: { x: 960, y: 190 },
    desert: { x: 1240, y: 840 },
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

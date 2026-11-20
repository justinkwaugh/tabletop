import type { Point } from '@tabletop/common'
import { Map1880, PrintedStubs1880, TileSet1880, TitleRules1880 } from '@tabletop/1880'
import type { TileRotation } from '@tabletop/18xx'
import {
    StandardTileLayouts,
    towardTileEdge,
    type MapViewDefinition,
    type TileLayout
} from '@tabletop/18xx-ui'
import { TrainColors1880 } from './trainPresentation.js'
import { investorToken } from './investorFlags.js'

/** Company colours, as the charters print them. */
export const CompanyColors1880: Readonly<Record<string, string>> = {
    JHA: '#ba6128',
    JHU: '#1e1e1e',
    JGG: '#534074',
    JLR: '#008a8b',
    BZU: '#9d8359',
    LHR: '#004294',
    SCR: '#282f1a',
    CKR: '#507eae',
    BCR: '#94121d',
    NXR: '#a83b5b',
    HKR: '#40743a',
    NJR: '#452518',
    QSR: '#b3932c',
    WNR: '#a4391f'
}

/** The foreign investors' tokens: their countries' flags, numbered as their charters (§VII). */
const InvestorStations = {
    A1: { label: '1', color: '#0039a6', imageUrl: investorToken('A1') },
    A2: { label: '2', color: '#bc002d', imageUrl: investorToken('A2') },
    A3: { label: '3', color: '#1a1a1a', imageUrl: investorToken('A3') },
    A4: { label: '4', color: '#dd0000', imageUrl: investorToken('A4') },
    A5: { label: '5', color: '#012169', imageUrl: investorToken('A5') },
    A6: { label: '6', color: '#046a38', imageUrl: investorToken('A6') },
    A7: { label: '7', color: '#002654', imageUrl: investorToken('A7') }
}

/** The point between the sides a city's track joins, or the centre where they are opposite. */
function between(edges: readonly number[], distance = 22): Point {
    const sum = edges.reduce(
        (total, edge) => {
            const point = towardTileEdge(edge, 1)
            return { x: total.x + point.x, y: total.y + point.y }
        },
        { x: 0, y: 0 }
    )
    const length = Math.hypot(sum.x, sum.y)
    if (length < 0.01) return { x: 0, y: 0 }
    return {
        x: Math.round((sum.x / length) * distance * 100) / 100,
        y: Math.round((sum.y / length) * distance * 100) / 100
    }
}

/** A tile's cities at the points given, in their order. */
function citiesAt(
    points: readonly Point[],
    annotations: Omit<TileLayout, 'nodePositions'> = {}
): TileLayout {
    return {
        nodePositions: Object.fromEntries(points.map((point, index) => [`city-${index}`, point])),
        ...annotations
    }
}

/**
 * A point on the drawn pointy hex, given for each of a tile's rotations: layout points turn with
 * the tile and the pointy hex's 30°, so each is turned back by both.
 */
function onEveryRotation(point: Point): Record<TileRotation, Point> {
    const turned = (rotation: TileRotation): Point => {
        const angle = (-(rotation * 60 + 30) * Math.PI) / 180
        return {
            x: Math.round((point.x * Math.cos(angle) - point.y * Math.sin(angle)) * 100) / 100,
            y: Math.round((point.x * Math.sin(angle) + point.y * Math.cos(angle)) * 100) / 100
        }
    }
    return { 0: turned(0), 1: turned(1), 2: turned(2), 3: turned(3), 4: turned(4), 5: turned(5) }
}

// A medium city prints a town within a city: both stand at the centre, the town drawn over.
const Boomtown: TileLayout = {
    nodePositions: { 'boomtown-city': { x: 0, y: 0 }, 'boomtown-town': { x: 0, y: 0 } }
}
// A double medium city prints two, on either side of the centre.
const DoubleBoomtown: TileLayout = {
    nodePositions: {
        'boomtown-city-0': towardTileEdge(1, 18),
        'boomtown-town-0': towardTileEdge(1, 18),
        'boomtown-city-1': towardTileEdge(4, 18),
        'boomtown-town-1': towardTileEdge(4, 18)
    }
}
// Two printed cities, one low on the left and one high on the right as the board prints them,
// the label in the open lower right. Given before the pointy tile's 30° turn: the cities land at
// (∓18, ±8) and the label at (22, 24).
const PrintedOO: TileLayout = citiesAt(
    [
        { x: -11.6, y: 15.9 },
        { x: 11.6, y: -15.9 }
    ],
    { labelPosition: { x: 31, y: 9.8 } }
)

const BoomtownIds = ['B14', 'L14', 'N10', 'E9', 'F6', 'O7']

/** A starting section printed on a side, as around Beijing: track no route uses until a tile. */
function stubTrack(edge: number): TileLayout['printedTrack'] {
    return [{ id: `stub-${edge}`, from: towardTileEdge(edge, 43.3), to: towardTileEdge(edge, 30) }]
}
const DoubleBoomtownIds = ['H8', 'N4']
const PrintedOOIds = ['D12', 'F4', 'N12', 'I9']

/**
 * The hexes whose stop only starts or ends a route (§X Operating Trains) print arrows rather than
 * track: the off-board areas holding a foreign investor, and the harbours, which print no town.
 */
const RouteEndLayouts: Readonly<Record<string, TileLayout>> = Object.fromEntries(
    Map1880.definition.locations.flatMap(({ id, preprintedTile: { nodes, paths } }) => {
        const arrows = paths.filter((path) => path.terminus)
        if (!arrows.length) return []
        const layout: TileLayout = {
            nodePositions: Object.fromEntries(nodes.map((node) => [node.id, { x: 0, y: 0 }])),
            printedPaths: Object.fromEntries(arrows.map((path) => [path.id, 'spike']))
        }
        return [[id, layout]]
    })
)

export const MapView1880: MapViewDefinition = {
    map: Map1880,
    tileSet: TileSet1880,
    // East of the tall map, top-aligned with it at TOP's market scale; the depot below the market
    // and the operating order list below the depot.
    boardAreas: {
        market: { x: 740, y: -50, width: 880, height: 624 },
        depot: { x: 740, y: 600, width: 381, height: 187 },
        panel: { x: 740, y: 812, width: 381, height: 300 }
    },
    stations: {
        ...Object.fromEntries(
            Object.entries(CompanyColors1880).map(([companyId, color]) => [
                companyId,
                { label: companyId, color }
            ])
        ),
        ...InvestorStations
    },
    terrainCostPrefix: TitleRules1880.currencySymbol,
    // Kaifeng & Zhengzhou's river cost stands above its low city, clear of the OO label.
    terrainPositions: { I9: { x: -17, y: -14 } },
    // The OO hexes' names on two lines, as the other two print.
    nameLines: { D12: ['Shenyang &', 'Fushun'], F4: ['Hohhot &', 'Datong'] },
    offboardNames: { fontSize: 11, color: '#4a0b0b' },
    revenueStageColors: {
        A: TrainColors1880['2'],
        B: TrainColors1880['3'],
        C: TrainColors1880['4+4'],
        D: TrainColors1880['8']
    },
    // The ferry fee printed beside each ferry's crossing.
    markerArt: {
        ferry: { note: { at: { x: 0, y: 26 }, fontSize: 12 } },
        'ferry-curved': { note: { at: { x: 20, y: 10 }, fontSize: 12 } }
    },
    layouts: {
        ...StandardTileLayouts,
        ...Object.fromEntries(BoomtownIds.map((id) => [id, Boomtown])),
        ...Object.fromEntries(
            Object.entries(PrintedStubs1880).map(([id, edge]) => [
                id,
                { ...(BoomtownIds.includes(id) ? Boomtown : {}), printedTrack: stubTrack(edge) }
            ])
        ),
        ...Object.fromEntries(DoubleBoomtownIds.map((id) => [id, DoubleBoomtown])),
        ...Object.fromEntries(PrintedOOIds.map((id) => [id, PrintedOO])),
        ...RouteEndLayouts,
        // Beijing's four printed cities near their starting sections, at full size; the B in
        // the centre and the cities' one shared revenue on an open side.
        F8: citiesAt(
            [0, 1, 3, 4].map((edge) => between([edge], 27)),
            {
                labelPosition: { x: 0, y: 0 },
                hideRevenue: ['city-1', 'city-2', 'city-3'],
                revenuePositions: { 'city-0': towardTileEdge(5, 29) }
            }
        ),
        '1880:235': citiesAt([between([0], 18), towardTileEdge(3, 18)]),
        '1880:8860': citiesAt([between([1, 5]), between([2, 4])]),
        '1880:8861': citiesAt([between([0, 1]), between([3, 4])]),
        '1880:8862': citiesAt([between([0, 5]), between([3, 4])]),
        '1880:8863': citiesAt([between([0, 1]), between([2, 5])]),
        '1880:8864': citiesAt([between([1, 5]), between([2, 3])]),
        '1880:8865': citiesAt([between([1, 5]), between([3, 4])]),
        // Brown and gray Beijing's one city fills the hex, its B white in the city's dark centre.
        '1880:8887': { labelPosition: { x: 0, y: 0 }, labelColor: '#fff' },
        '1880:8888': { labelPosition: { x: 0, y: 0 }, labelColor: '#fff' },
        // Green Beijing's six cities at full size, and in the centre the B over one revenue for
        // all, upright however the tile turns.
        '1880:8886': citiesAt(
            [0, 1, 2, 3, 4, 5].map((edge) => between([edge], 27)),
            {
                labelPositionByRotation: onEveryRotation({ x: 0, y: -6 }),
                hideRevenue: ['city-1', 'city-2', 'city-3', 'city-4', 'city-5'],
                revenuePositionsByRotation: Object.fromEntries(
                    Object.entries(onEveryRotation({ x: 0, y: 7.5 })).map(([rotation, point]) => [
                        rotation,
                        { 'city-0': point }
                    ])
                )
            }
        )
    }
}

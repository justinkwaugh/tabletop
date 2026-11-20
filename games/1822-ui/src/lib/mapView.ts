import {
    EnglishChannelLocationId,
    EnglishChannelTileIds1822,
    LondonLocationId,
    LondonNodeIds,
    LondonTileIds1822,
    Majors1822,
    Map1822,
    destinationStationId,
    MerthyrToPontypoolSide,
    MerthyrTydfilLocationId,
    MidWalesLocationId,
    OffBoardAreas1822,
    Minors1822,
    OverlayPieces1822,
    SouthwestTileIds1822,
    OystermouthNodeId,
    PontypoolLocationId,
    PontypoolToMerthyrSide,
    SwanseaLocationId,
    TileSet1822
} from '@tabletop/1822'
import { TileEdges, type TileEdge } from '@tabletop/18xx'
import { assert, type Point } from '@tabletop/common'
import {
    SpecialStationOutline,
    StandardTileLayouts,
    TileApothem,
    towardTileEdge,
    type MapViewDefinition,
    type StationAppearance,
    type TileLayout
} from '@tabletop/18xx-ui'
import { MinorColor1822 } from './companyPresentation.js'
import { destinationMarkerKind, destinationStationMarkerKind } from './destinationMarkers.js'
import { Logos1822 } from './logos.js'
import { TrainColors1822 } from './trainPresentation.js'

const [LondonValueNode, ...OtherLondonNodes] = LondonNodeIds
const LondonStationReach = 29
/** How far the Metropolitan Railway's space beside a London station stands from it. */
const LondonSpaceSpacing = 7
/** How far London's spikes reach past its sides into the hexes beside it. */
const LondonSpikeReach = 22
/** Half the width of a spike where it leaves London's side. */
const LondonSpikeHalfWidth = 5

const plus = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const scaled = (a: Point, by: number): Point => ({ x: a.x * by, y: a.y * by })

// London's six stations stand in a ring out at the sides their track leaves by, with its name and
// the value they share in the middle; the upgrade's cost and the L stand in the side corners, and a
// spike from each side reaches out into the hex beyond (§1.2.3, §5.10.1).
const LondonLayout: TileLayout = {
    nodePositions: Object.fromEntries(
        LondonNodeIds.map((nodeId, side) => [nodeId, towardTileEdge(side, LondonStationReach)])
    ),
    overhangs: TileEdges.map((side) => {
        // Its base just inside the side, across it either way; its point out in the hex beyond.
        const base = towardTileEdge(side, TileApothem - 1)
        const across = towardTileEdge(side + 1.5, LondonSpikeHalfWidth)
        return [
            minus(base, across),
            towardTileEdge(side, TileApothem + LondonSpikeReach),
            plus(base, across)
        ]
    }),
    printedText: [{ content: 'London', at: { x: 0, y: -7 }, fontSize: 6.5 }],
    revenuePositions: { [LondonValueNode]: { x: 0, y: 6.5 } },
    hideRevenue: OtherLondonNodes,
    upgradeCostPosition: { x: -41, y: 0 },
    upgradeCostText: { prefix: '£' },
    labelPosition: { x: 42, y: -3 }
}

// The board prints London's hex black, its stations' track left out for the spikes (§1.2.3); the
// tiles laid over it are in their own colours.
const LondonBoardLayout: TileLayout = {
    ...LondonLayout,
    inkGround: true,
    printedPaths: Object.fromEntries(TileEdges.map((side) => [`edge-${side}`, 'hidden']))
}

// The space beside a London station, which only the Metropolitan Railway or the major company
// that acquires it takes (§5.10.3): the station keeps its place and the space beside it overlaps
// it toward the middle of London.
const LondonRoundelLayouts: Readonly<Record<string, TileLayout>> = Object.fromEntries(
    LondonNodeIds.map((nodeId, side) => [
        nodeId,
        {
            nodePositions: {
                [nodeId]: towardTileEdge(side, LondonStationReach - LondonSpaceSpacing)
            },
            slotRowTurns: { [nodeId]: 90 + side * 60 },
            slotSpacing: { [nodeId]: LondonSpaceSpacing }
        }
    ])
)

/**
 * Where Mid Wales' station stands: in the middle of its area, east of E28's own middle, a little
 * low, since its three spaces stand higher about their middle than below it.
 */
const MidWalesStation = { x: 52, y: 5 }

const ThreeStations: TileLayout = {
    nodePositions: { city: { x: 12, y: 0 } },
    revenuePositions: { city: { x: -25, y: 0 } }
}

// The Channel's EC and the cost of its upgrades, apart below its station (§5.9.1).
const ChannelLayout: TileLayout = {
    labelPosition: { x: 4, y: 30 },
    upgradeCostPosition: { x: -24, y: 20 }
}

// Two small stations of an undeveloped hex, side by side.
const TwoTowns: TileLayout = {
    nodePositions: { 'town-0': { x: -15, y: 4 }, 'town-1': { x: 15, y: 4 } }
}

// A grey area's four values in a row above its two stations.
const GreyAreaValues: TileLayout = { revenuePositions: { city: { x: 0, y: -23 } } }

// An overlay's arrows are spikes at the hex side they enter by (scenario pack, overlays).
// Southwest England's second hex prints its two arrows and nothing more: their tracks run on
// to the station unseen.
const OverlayLayouts: Readonly<Record<string, TileLayout>> = Object.fromEntries(
    OverlayPieces1822.map(({ tile, arrowPathIds }) => [
        tile.id,
        {
            ...(tile.face.nodes.some((node) => node.kind === 'city' && node.stationSlots === 3)
                ? ThreeStations
                : GreyAreaValues),
            printedPaths: Object.fromEntries(
                tile.face.paths.map((path) => [
                    path.id,
                    arrowPathIds.includes(path.id) ? ('spike' as const) : ('hidden' as const)
                ])
            )
        }
    ])
)

// Southwest England's two tiles print as one area: its station stands to the west, clear of its
// arrows, and its values in a column below it in the second hex, clear of that hex's arrows.
const SouthwestLayout: TileLayout = {
    ...OverlayLayouts[SouthwestTileIds1822.station],
    nodePositions: { city: { x: -12, y: 0 } },
    revenuePositions: { city: plus(towardTileEdge(0, 2 * TileApothem), { x: -12, y: 0 }) },
    revenueStack: 'column'
}

export const TileLayouts1822: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    ...OverlayLayouts,
    [SouthwestTileIds1822.station]: SouthwestLayout,
    ...Object.fromEntries(LondonTileIds1822.map((id) => [id, LondonLayout])),
    ...Object.fromEntries(EnglishChannelTileIds1822.map((id) => [id, ChannelLayout]))
}

/**
 * A grey off-board area as the board prints it: its hexes one region, no track drawn inside it,
 * and a short spike pointing in at each side a connection crosses (§5.4.4). A track between two
 * sides is spiked at its first, so the map names the side on the area's edge first.
 */
function offBoardArea(locationIds: readonly string[]) {
    return locationIds.map((locationId) => {
        const inside = (edge: TileEdge) => {
            const neighborId = Map1822.neighbor(locationId, edge)?.id
            return !!neighborId && locationIds.includes(neighborId)
        }
        const printedPaths = Object.fromEntries(
            Map1822.location(locationId).preprintedTile.paths.map((path) => {
                const sides = path.endpoints.flatMap((end) =>
                    end.kind === 'edge' ? [end.edge] : []
                )
                if (sides.every(inside)) return [path.id, 'hidden' as const]
                assert(
                    !inside(sides[0]),
                    `${locationId} ${path.id} names the side on its area's edge first`
                )
                return [path.id, 'spike' as const]
            })
        )
        return { locationId, joinedEdges: TileEdges.filter(inside), printedPaths }
    })
}
const OffBoardAreaDrawings = OffBoardAreas1822.flatMap(offBoardArea)
/** How far a spike reaches in from an area's edge, as a share of the way to the far end. */
const AreaSpikeReach = 0.4

/**
 * The print shows Merthyr Tydfil's and Pontypool's one connection as two straight pointed
 * tracks side by side across the middle of their shared side, each from its own station to a
 * point in the other's hex (§5.4.7); the track routes use is drawn beneath them. Each hex draws
 * its own part: its city's track up to the shared side, and the other's point beyond it. Points
 * here are in Merthyr Tydfil's hex; Pontypool's middle lies across its north-east side.
 */
const PontypoolMiddle = towardTileEdge(MerthyrToPontypoolSide, 2 * TileApothem)
/** Square to the shared side, from Merthyr Tydfil toward Pontypool, and along it. */
const Across = scaled(PontypoolMiddle, 1 / Math.hypot(PontypoolMiddle.x, PontypoolMiddle.y))
const Along: Point = { x: -Across.y, y: Across.x }
const SideMiddle = scaled(PontypoolMiddle, 0.5)
/** How far apart the two tracks run; how far back each starts, under its station; how far each point reaches. */
const CrossingGap = 6
const StationDepth = 40
const PointReach = 16

/** A point on one of the two tracks: its offset along the side, and its distance across it. */
const onTrack = (offset: number, distance: number) =>
    plus(SideMiddle, plus(scaled(Along, offset), scaled(Across, distance)))
// Merthyr Tydfil's track runs below Pontypool's, as printed.
const MerthyrTrack = {
    start: onTrack(CrossingGap, -StationDepth),
    side: onTrack(CrossingGap, 0),
    tip: onTrack(CrossingGap, PointReach)
}
const PontypoolTrack = {
    start: onTrack(-CrossingGap, StationDepth),
    side: onTrack(-CrossingGap, 0),
    tip: onTrack(-CrossingGap, -PointReach)
}
// Each station stands clear of its values, over the start of its track.
const MerthyrStation: Point = { x: 4, y: 7 }
const PontypoolStation: Point = { x: 10, y: 2 }

function crossingLayout(
    own: { start: Point; side: Point },
    other: { side: Point; tip: Point },
    origin: Point,
    pathId: string
): TileLayout {
    const local = (point: Point) => minus(point, origin)
    return {
        printedPaths: { [pathId]: 'hidden' },
        printedTrack: [
            { id: 'crossing-out', from: local(own.start), to: local(own.side) },
            { id: 'crossing-in', from: local(other.side), to: local(other.tip), spike: true }
        ]
    }
}

const PrintedLayouts: Readonly<Record<string, TileLayout>> = {
    [LondonLocationId]: LondonBoardLayout,
    // Swansea with Oystermouth to its south-west, joined by the printed track (§1.2.2).
    [SwanseaLocationId]: {
        nodePositions: { city: { x: 6, y: -6 }, [OystermouthNodeId]: towardTileEdge(1, 30) }
    },
    // The grey areas' four values stand clear of their two stations and their track.
    // Each station stands away from the other, as printed, so that the points read between them.
    [PontypoolLocationId]: {
        ...GreyAreaValues,
        nodePositions: { city: PontypoolStation },
        ...crossingLayout(
            PontypoolTrack,
            MerthyrTrack,
            PontypoolMiddle,
            `edge-${PontypoolToMerthyrSide}`
        )
    },
    H1: GreyAreaValues,
    // The Highlands' station stands upright across the side its two hexes share, in the middle of
    // the area, with its values above it.
    E2: {
        nodePositions: { city: towardTileEdge(0, TileApothem) },
        slotRowTurns: { city: 90 },
        revenuePositions: { city: { x: 0, y: -12 } },
        spikesTowardMiddle: true
    },
    // Cornwall's station and values stand upright, side by side, clear of its two spikes.
    A42: {
        nodePositions: { city: { x: 6, y: 4 } },
        slotRowTurns: { city: 90 },
        revenuePositions: { city: { x: -24, y: 0 } },
        revenueStack: 'column'
    },
    // Where a spike comes in from the east, the station stands back west to leave its point clear.
    ...Object.fromEntries(
        ['C34', 'F23'].map((id) => [
            id,
            { ...GreyAreaValues, nodePositions: { city: { x: -6, y: 4 } } }
        ])
    ),
    // The large cities' letters stand clear of their stations and track.
    G36: {
        nodePositions: { city: { x: 8, y: 8 } },
        revenuePositions: { city: { x: -30, y: 16 } },
        labelPosition: { x: -12, y: 32 }
    },
    I22: { nodePositions: { city: { x: 12, y: -2 } }, labelPosition: { x: -32, y: -6 } },
    I30: { labelPosition: { x: 18, y: 24.5 } },
    [MerthyrTydfilLocationId]: {
        nodePositions: { city: MerthyrStation },
        // Its two spaces stand one above the other, the upper over the start of its track.
        slotRowTurns: { city: 90 },
        revenuePositions: { city: { x: -24, y: 0 } },
        revenueStack: 'column',
        ...crossingLayout(
            MerthyrTrack,
            PontypoolTrack,
            { x: 0, y: 0 },
            `edge-${MerthyrToPontypoolSide}`
        )
    },
    // Three stations beside their column of values.
    E6: ThreeStations,
    // Mid Wales' station stands in the middle of its area, as printed, over the hexes east of
    // its own, with its values beside it.
    [MidWalesLocationId]: {
        nodePositions: { city: MidWalesStation },
        revenuePositions: { city: { x: MidWalesStation.x - 46, y: 0 } },
        revenueStack: 'column'
    },
    [EnglishChannelLocationId]: ChannelLayout,
    F7: TwoTowns,
    H21: TwoTowns,
    H37: TwoTowns
}

// Off-shore arrows are wedges from the coast pointing out to sea, as printed (§5.8.8).
const SeaLayouts: Readonly<Record<string, TileLayout>> = Object.fromEntries(
    Map1822.definition.locations
        .filter((location) => location.preprintedTile.color === 'blue')
        .map((location) => [
            location.id,
            {
                printedPaths: Object.fromEntries(
                    location.preprintedTile.paths.map((path) => [path.id, 'spike' as const])
                ),
                spikeReach: AreaSpikeReach
            }
        ])
)

// The off-board areas' own drawing, over whatever else their hexes' layouts say.
const AreaLayouts: Readonly<Record<string, TileLayout>> = Object.fromEntries(
    OffBoardAreaDrawings.map(({ locationId, printedPaths }) => [
        locationId,
        { ...PrintedLayouts[locationId], printedPaths, spikeReach: AreaSpikeReach }
    ])
)

/** Destination marks set apart from their hex's corner, clear of a station that fills it. */
const DestinationMarkerPlaces: Readonly<Record<string, { at: Point }>> = {
    // Fishguard's two spaces stand across the middle of the hex: its mark sits beneath them.
    SWR: { at: { x: -6, y: 30 } }
}

const Stations: Readonly<Record<string, StationAppearance>> = Object.fromEntries([
    ...Majors1822.map((major) => [
        major.id,
        { label: major.initials, color: major.color, imageUrl: Logos1822[major.id] }
    ]),
    ...Minors1822.map((minor) => [
        minor.id,
        { label: minor.id.slice(1), color: MinorColor1822, imageUrl: Logos1822[minor.id] }
    ])
])

export const MapView1822: MapViewDefinition = {
    // East of the map, in the North Sea: the market beside Scotland and the north of England at
    // TOP's market scale, the depot under its short lower rows, and the bidding boxes below.
    boardAreas: {
        market: { x: 1040, y: -60, width: 1154, height: 906 },
        depot: { x: 1610, y: 500, width: 570, height: 330 },
        panel: { x: 1360, y: 880, width: 834, height: 520 }
    },
    map: Map1822,
    tileSet: TileSet1822,
    boardTiles: Object.fromEntries(
        OverlayPieces1822.map(({ tile, name, outOfPlay }) => [
            tile.id,
            { ...(name ? { name } : {}), ...(outOfPlay ? { outOfPlay } : {}) }
        ])
    ),
    stations: Stations,
    // A major company's destination shows its token beside the city until it connects there, as
    // the board prints the company's mark, then an outline on the destination token it placed
    // (§5.11.7).
    locationMarkerNames: Object.fromEntries(
        Majors1822.flatMap((major) => [
            [destinationMarkerKind(major.id), `${major.initials} destination`],
            [destinationStationMarkerKind(major.id), `${major.initials} destination station`]
        ])
    ),
    markerArt: Object.fromEntries(
        Majors1822.flatMap((major) => [
            [
                destinationMarkerKind(major.id),
                {
                    token: {
                        imageUrl: Logos1822[major.id],
                        place: DestinationMarkerPlaces[major.id] ?? ('corner' as const)
                    }
                }
            ],
            [
                destinationStationMarkerKind(major.id),
                {
                    stationOutline: {
                        stationId: destinationStationId(major.id),
                        color: SpecialStationOutline
                    }
                }
            ]
        ])
    ),
    // Mid Wales' name stands over its station, as large as the board prints it.
    namePositions: {
        [MidWalesLocationId]: { x: MidWalesStation.x + 10, y: -41 },
        // Below the cost of the estuary on their north side.
        G36: { x: -10, y: -30 },
        H5: { x: 0, y: -24 }
    },
    // Terrain costs stand clear of the large cities' track.
    terrainPositions: {
        G36: { x: -20, y: -14 },
        I22: { x: 0, y: -24 },
        I30: { x: 0, y: -24 }
    },
    // London's roundel prints its name.
    hideLocationNames: [LondonLocationId],
    nameStyles: { [MidWalesLocationId]: { fontSize: 10, color: '#161616' } },
    layouts: { ...TileLayouts1822, ...PrintedLayouts, ...AreaLayouts, ...SeaLayouts },
    joinedEdges: Object.fromEntries(
        OffBoardAreaDrawings.filter((area) => area.joinedEdges.length).map((area) => [
            area.locationId,
            area.joinedEdges
        ])
    ),
    // Stations and values that stand across a side into the hex beside them: the Highlands'
    // station, Mid Wales' station, and southwest England's values in a scenario overlay.
    drawnLast: ['E2', MidWalesLocationId, 'E38'],
    joinedTileEdges: {
        [SouthwestTileIds1822.station]: [0],
        [SouthwestTileIds1822.approach]: [3]
    },
    sharedCityLayouts: Object.fromEntries(
        [LondonLocationId, ...LondonTileIds1822].map((id) => [id, LondonRoundelLayouts])
    ),
    // Rough terrain, hills and mountains (£40, £60 and £80) as one, two and three peaks (§5.8.9).
    terrainIcons: { rough: 'peak', hill: 'mountain', mountain: 'range' },
    terrainCostPrefix: '£',
    // Grey areas print four values, paid in the phases of yellow, green, brown and grey tiles
    // (§5.4.5).
    revenueStageColors: {
        yellow: TrainColors1822['2'],
        green: TrainColors1822['3'],
        brown: TrainColors1822['5'],
        gray: TrainColors1822['7']
    }
}

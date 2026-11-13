import {
    EnglishChannelLocationId,
    EnglishChannelTileIds1822,
    LondonLocationId,
    LondonNodeIds,
    LondonTileIds1822,
    Majors1822,
    Map1822,
    Minors1822,
    OystermouthNodeId,
    SwanseaLocationId,
    TileSet1822
} from '@tabletop/1822'
import {
    StandardTileLayouts,
    towardTileEdge,
    type MapViewDefinition,
    type StationAppearance,
    type TileLayout
} from '@tabletop/18xx-ui'
import { MinorColor1822 } from './companyPresentation.js'
import { Logos1822 } from './logos.js'
import { TrainColors1822 } from './trainPresentation.js'

const [LondonValueNode, ...OtherLondonNodes] = LondonNodeIds
const LondonStationReach = 24

// London's six stations stand toward the sides their track leaves by, round the roundel in the
// middle; the one value they share, the L and the upgrade's cost stand in three of the corners
// between them (§1.2.3, §5.10.1).
const LondonLayout: TileLayout = {
    nodePositions: Object.fromEntries(
        LondonNodeIds.map((nodeId, side) => [nodeId, towardTileEdge(side, LondonStationReach)])
    ),
    revenuePositions: { [LondonValueNode]: { x: -40, y: 0 } },
    hideRevenue: OtherLondonNodes,
    labelPosition: { x: 40, y: 0 },
    upgradeCostPosition: { x: 20, y: -35 }
}

// The roundel's space beside a London station, which only the Metropolitan Railway or the major
// company that acquires it takes (§5.10.3): the station keeps its place and the space beside it
// stands in the middle of London.
const LondonRoundelLayouts: Readonly<Record<string, TileLayout>> = Object.fromEntries(
    LondonNodeIds.map((nodeId, side) => [
        nodeId,
        {
            nodePositions: { [nodeId]: towardTileEdge(side, LondonStationReach - 11) },
            slotRowTurns: { [nodeId]: 90 + side * 60 }
        }
    ])
)

const ThreeStations: TileLayout = {
    nodePositions: { city: { x: 12, y: 0 } },
    revenuePositions: { city: { x: -25, y: 0 } }
}

// The Channel's EC and the cost of its upgrades, apart below its station (§5.9.1).
const ChannelLayout: TileLayout = {
    labelPosition: { x: 24, y: 28 },
    upgradeCostPosition: { x: -18, y: 31 }
}

// Two small stations of an undeveloped hex, side by side.
const TwoTowns: TileLayout = {
    nodePositions: { 'town-0': { x: -15, y: 4 }, 'town-1': { x: 15, y: 4 } }
}

export const TileLayouts1822: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    ...Object.fromEntries(LondonTileIds1822.map((id) => [id, LondonLayout])),
    ...Object.fromEntries(EnglishChannelTileIds1822.map((id) => [id, ChannelLayout]))
}

const PrintedLayouts: Readonly<Record<string, TileLayout>> = {
    [LondonLocationId]: LondonLayout,
    // Swansea with Oystermouth to its south-west, joined by the printed track (§1.2.2).
    [SwanseaLocationId]: {
        nodePositions: { city: { x: 6, y: -6 }, [OystermouthNodeId]: towardTileEdge(1, 30) }
    },
    // The grey areas' four values stand clear of their two stations and their track.
    ...Object.fromEntries(
        ['A42', 'C34', 'E2', 'F23', 'H1', 'F33'].map((id) => [
            id,
            { revenuePositions: { city: { x: 0, y: -23 } } }
        ])
    ),
    E34: { revenuePositions: { city: { x: -4, y: 21 } } },
    // Three stations beside their column of values.
    E6: ThreeStations,
    // Mid Wales' pairs of tracks run side by side without crossing on their way south.
    E28: { ...ThreeStations, flippedLaneEdges: [0] },
    E30: { flippedLaneEdges: [3] },
    [EnglishChannelLocationId]: ChannelLayout,
    F7: TwoTowns,
    H21: TwoTowns,
    H37: TwoTowns
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
    stations: Stations,
    layouts: { ...TileLayouts1822, ...PrintedLayouts },
    sharedCityLayouts: Object.fromEntries(
        [LondonLocationId, ...LondonTileIds1822].map((id) => [id, LondonRoundelLayouts])
    ),
    borderWidths: { impassable: 5 },
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

import RebellionIcon from './images/icons/NWR.svg'
import FishIcon from './images/icons/fish.svg'
import NeutralStationArt from './images/neutral-station.svg'
import type { Point } from '@tabletop/common'
import { HbId, Map1882, ScId, TbId, TileSet1882, TitleRules1882 } from '@tabletop/1882'
import {
    StandardTileLayouts,
    towardTileEdge,
    type MapViewDefinition,
    type TileLayout
} from '@tabletop/18xx-ui'
import { TrainColors1882 } from './trainPresentation.js'

/** Company colours, as their logos print them. */
export const CompanyColors1882: Readonly<Record<string, string>> = {
    CN: '#ffa100',
    CNoR: '#247237',
    CPR: '#d91a3e',
    GTP: '#231f20',
    HBR: '#ffd330',
    QL: '#7f117e',
    SCR: '#008ccd'
}

// Regina's two printed cities each face their one track, their values beside them.
const Regina: TileLayout = {
    nodePositions: { 'city-0': towardTileEdge(1, 19), 'city-1': towardTileEdge(4, 19) },
    // Low on the left and on the right, clear of the river costs on Regina's upper sides.
    revenuePositions: { 'city-0': { x: -25, y: 27 }, 'city-1': { x: 31, y: 10 } },
    labelPosition: towardTileEdge(0, 33)
}
// The printed OO hexes' cities stand as the board prints them, one low on the left and one high
// in the middle, the label low on the right, clear of the rebellion marker's right side.
const PrintedOO: TileLayout = {
    nodePositions: { 'city-0': { x: -14, y: 6 }, 'city-1': { x: 4, y: -13 } },
    labelPosition: { x: 12, y: 17 }
}

// R1's two cities each stand toward the corner between their two sides.
const ReginaGreen: TileLayout = {
    nodePositions: {
        'city-0': towardTileEdge(0.5, 20),
        'city-1': towardTileEdge(2.5, 20)
    },
    revenuePositions: {
        'city-0': towardTileEdge(5.3, 30),
        'city-1': towardTileEdge(3.7, 30)
    },
    labelPosition: towardTileEdge(1.5, 36)
}

/**
 * Each off-board area's name, values and Hudson Bay bonus stand together clear of its track, as
 * the board prints them: down from the hex's top edge, on the side away from its spikes.
 */
const OffboardFaces: Readonly<
    Record<string, { name: Point; values: Point; stack: NonNullable<TileLayout['revenueStack']> }>
> = {
    // Spikes south and south-east.
    B2: { name: { x: -4, y: -25 }, values: { x: -21, y: 6 }, stack: 'row' },
    // Spikes south and south-west.
    B12: { name: { x: 4, y: -25 }, values: { x: 21, y: 6 }, stack: 'row' },
    // Spikes north-east and south-east.
    I1: { name: { x: -9, y: -20 }, values: { x: -12, y: 8 }, stack: 'row' },
    // Spikes north-west and south-west.
    I13: { name: { x: 9, y: -20 }, values: { x: 12, y: 8 }, stack: 'row' },
    // A spike north.
    O11: { name: { x: 0, y: 6 }, values: { x: 0, y: 22 }, stack: 'row' },
    // Spikes south and south-west; the fish takes the east corner.
    B6: { name: { x: 0, y: -26 }, values: { x: 0, y: -12 }, stack: 'row' }
}

export const MapView1882: MapViewDefinition = {
    map: Map1882,
    tileSet: TileSet1882,
    // East of the map, top-aligned with it at TOP's market scale; the depot stands in the market's
    // empty lower right.
    boardAreas: {
        market: { x: 962, y: -50, width: 1004, height: 760 },
        depot: { x: 1420, y: 420, width: 381, height: 187 }
    },
    stations: Object.fromEntries(
        Object.entries(CompanyColors1882).map(([companyId, color]) => [
            companyId,
            { label: companyId, color }
        ])
    ),
    // Unlabelled, as the board's neutral markers (§2, §4), striped so they stand apart from the
    // white of an empty city circle and from every company's colour.
    neutralStation: { label: '', color: '#6f685b', imageUrl: NeutralStationArt },
    terrainCostPrefix: TitleRules1882.currencySymbol,
    offboardNames: { fontSize: 11, color: '#4a0b0b' },
    // Names that would sit under a river cost on the hex's top side move below it, or under
    // their cities, as the board prints them.
    namePositions: {
        E5: { x: 0, y: 34 },
        M11: { x: 0, y: 34 },
        F4: { x: 0, y: -14 },
        M3: { x: 0, y: -14 },
        F8: { x: 0, y: 18 },
        J10: { x: 0, y: -24 },
        ...Object.fromEntries(
            Object.entries(OffboardFaces).map(([locationId, { name }]) => [locationId, name])
        )
    },
    nameLines: { F8: ['Rosthern &', 'Melfort'] },
    revenueStageColors: { yellow: TrainColors1882['2'], brown: TrainColors1882['5'] },
    layouts: {
        ...StandardTileLayouts,
        '1882:R1': ReginaGreen,
        J10: Regina,
        E5: PrintedOO,
        M11: PrintedOO,
        ...Object.fromEntries(
            Object.entries(OffboardFaces).map(([locationId, { values, stack }]) => [
                locationId,
                { revenuePositions: { offboard: values }, revenueStack: stack }
            ])
        )
    },
    markerArt: {
        // On the hex's right side, as the board prints it, or the clear spot nearest there.
        nwr: { token: { imageUrl: RebellionIcon, place: { near: { x: 33, y: 0 } } } },
        fishing: { token: { imageUrl: FishIcon, place: { near: { x: 26, y: 4 } } } },
        'hudson-bay': { revenueBadge: true },
        ...Object.fromEntries(
            [HbId, ScId, TbId].map((id) => [`blocks-${id}`, { localLine: true, above: true }])
        )
    }
}

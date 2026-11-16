import PRRLogo from './images/logos/PRR.svg'
import PLELogo from './images/logos/PLE.svg'
import SRRLogo from './images/logos/SRR.svg'
import BOLogo from './images/logos/BO.svg'
import COLogo from './images/logos/CO.svg'
import LVLogo from './images/logos/LV.svg'
import CALogo from './images/logos/CA.svg'
import NWLogo from './images/logos/NW.svg'
import type { Point } from '@tabletop/common'
import {
    MapChesapeake,
    PrivateBlocks,
    TileSetChesapeake,
    TitleRulesChesapeake
} from '@tabletop/18chesapeake'
import { CompanyNamesChesapeake } from './companyPresentation.js'
import {
    StandardTileLayouts,
    towardTileEdge,
    type MapViewDefinition,
    type TileLayout
} from '@tabletop/18xx-ui'
import { TrainColorsChesapeake } from './trainPresentation.js'

/** Company colours, as their charters print them. */
export const CompanyColorsChesapeake: Readonly<Record<string, string>> = {
    PRR: '#237333',
    PLE: '#231f20',
    SRR: '#d81e3e',
    BO: '#0189d1',
    CO: '#a2dced',
    LV: '#fff500',
    CA: '#f48221',
    NW: '#7b352a'
}

const Logos: Readonly<Record<string, string>> = {
    PRR: PRRLogo,
    PLE: PLELogo,
    SRR: SRRLogo,
    BO: BOLogo,
    CO: COLogo,
    LV: LVLogo,
    CA: CALogo,
    NW: NWLogo
}

const twoCities = (
    first: Point,
    second: Point,
    annotations: Omit<TileLayout, 'nodePositions'> = {}
): TileLayout => ({
    nodePositions: { 'city-0': first, 'city-1': second },
    ...annotations
})

/**
 * The printed OO hexes' labels where the board prints them: Baltimore's upper left,
 * Philadelphia's upper right with its values down the left.
 */
const PrintedOO: Readonly<Record<string, TileLayout>> = {
    H6: twoCities(towardTileEdge(1, 19), towardTileEdge(4, 19), {
        labelPosition: towardTileEdge(2.2, 24)
    }),
    J4: twoCities(towardTileEdge(0, 19), towardTileEdge(3, 19), {
        labelPosition: { x: 27, y: 0 },
        revenuePositions: {
            'city-0': towardTileEdge(1, 30),
            'city-1': towardTileEdge(2, 30)
        }
    })
}

/**
 * The OO and DC tiles' labels, each in a corner or on a side no track takes.
 */
const TitleTileLayouts: Readonly<Record<string, TileLayout>> = {
    // Two gentle curves, bottom to upper left and top to lower right, drawn as tile 8 draws
    // them; each city stands along its curve toward the upper left or the lower right, its value
    // in the corner beyond it, the label inside the lower-left curve.
    '18chesapeake:X3': twoCities(
        { x: -19.3, y: -6.9 },
        { x: 19.3, y: 6.9 },
        {
            pathControls: {
                'city-0-edge-0': [
                    { x: 0, y: 24.8 },
                    { x: -6.9, y: 6.9 }
                ],
                'city-0-edge-2': [
                    { x: -30.7, y: -17.7 },
                    { x: -24.5, y: -12.7 }
                ],
                'city-1-edge-3': [
                    { x: 0, y: -24.8 },
                    { x: 6.9, y: -6.9 }
                ],
                'city-1-edge-5': [
                    { x: 30.7, y: 17.7 },
                    { x: 24.5, y: 12.7 }
                ]
            },
            revenuePositions: { 'city-0': { x: -13, y: -31 }, 'city-1': { x: 13, y: 31 } },
            labelPosition: { x: -24.5, y: 18 }
        }
    ),
    // Cities joining the bottom and lower left, and the upper left and top: the right is clear.
    '18chesapeake:X4': twoCities(towardTileEdge(0.5, 22), towardTileEdge(2.5, 22), {
        revenuePositions: { 'city-0': towardTileEdge(5.2, 31), 'city-1': towardTileEdge(3.8, 31) },
        labelPosition: towardTileEdge(4.5, 29)
    }),
    // Cities joining the top and lower right, and the bottom and upper right: the left is clear.
    '18chesapeake:X5': twoCities(towardTileEdge(3.5, 24), towardTileEdge(5.5, 22), {
        revenuePositions: { 'city-0': towardTileEdge(2.2, 31), 'city-1': towardTileEdge(0.8, 31) },
        labelPosition: towardTileEdge(1.5, 29)
    }),
    // Two-space cities leave the top side clear for the label.
    '18chesapeake:X2': { labelPosition: towardTileEdge(3, 33) },
    '18chesapeake:X7': { labelPosition: towardTileEdge(3, 33) },
    // Below the three spaces, right of the bottom track.
    '18chesapeake:X9': { labelPosition: { x: 16, y: 33 } },
    // Toward the right corner, clear of the four spaces.
    '18chesapeake:X8': { labelPosition: { x: 38, y: 0 } }
}

export const MapViewChesapeake: MapViewDefinition = {
    map: MapChesapeake,
    tileSet: TileSetChesapeake,
    // East of the map at TOP's market scale, top-aligned with the map: tall enough for the Off the
    // Rails market, which the printed one leaves empty below. The depot stands in the empty lower
    // right of either.
    boardAreas: {
        market: { x: 890, y: -50, width: 1066, height: 760 },
        depot: { x: 1440, y: 300, width: 381, height: 187 }
    },
    stations: Object.fromEntries(
        Object.entries(CompanyColorsChesapeake).map(([companyId, color]) => [
            companyId,
            {
                label: CompanyNamesChesapeake[companyId]?.initials ?? companyId,
                color,
                imageUrl: Logos[companyId]
            }
        ])
    ),
    terrainCostPrefix: TitleRulesChesapeake.currencySymbol,
    revenueStageColors: {
        yellow: TrainColorsChesapeake['2'],
        green: TrainColorsChesapeake['3'],
        brown: TrainColorsChesapeake['5'],
        gray: TrainColorsChesapeake.D
    },
    // Pittsburgh and the West Virginia coal fields each print as one red area over two hexes.
    joinedEdges: { A3: [4], B2: [1], A13: [5], B14: [2] },
    nameLines: {
        B4: ['Charleroi &', 'Connellsville'],
        K3: ['Trenton &', 'Amboy'],
        K5: ['Burlington &', 'Princeton'],
        I9: ['Delmarva', 'Peninsula'],
        B14: ['West Virginia', 'Coal']
    },
    // Each joined area prints its name once.
    hideLocationNames: ['A13'],
    layouts: {
        ...StandardTileLayouts,
        ...TitleTileLayouts,
        ...PrintedOO,
        // The joined areas print their values once.
        A3: { hideRevenue: true },
        A13: { hideRevenue: true }
    },
    markerArt: Object.fromEntries(
        Object.keys(PrivateBlocks).map((id) => [`blocks-${id}`, { localLine: true, above: true }])
    )
}

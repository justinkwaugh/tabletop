import { calculateHexGeometry, HexOrientation, type Point } from '@tabletop/common'
import { Map1833NE, TileSet1833NE } from '@tabletop/1833ne'
import {
    StandardTileLayouts,
    TileRadius,
    towardTileEdge,
    type MapBonusArrow,
    type MapViewDefinition,
    type TileLayout
} from '@tabletop/18xx-ui'
import { PhaseColors1833NE } from './trainPresentation.js'

const Boston: TileLayout = {
    nodePositions: {
        'city-0': towardTileEdge(1, 20),
        'city-1': towardTileEdge(3, 20),
        terminal: towardTileEdge(0, 26)
    }
}
const Montreal: TileLayout = {
    nodePositions: { 'city-0': towardTileEdge(5, 20), 'city-1': towardTileEdge(2, 20) }
}
const Portland: TileLayout = {
    nodePositions: {
        'city-0': towardTileEdge(4.5, 18),
        'terminal-0': towardTileEdge(1, 26),
        'terminal-1': towardTileEdge(2, 26)
    }
}

/** Tile layouts are given before the tile's rotation, toward each stop's own track. */
export const TileLayouts1833NE: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    '1833ne:N23': {
        nodePositions: {
            'city-0': towardTileEdge(0, 18),
            'city-1': towardTileEdge(3.5, 20),
            terminal: towardTileEdge(2, 26)
        }
    },
    '1833ne:N24': {
        nodePositions: {
            'city-0': towardTileEdge(1, 20),
            'city-1': towardTileEdge(3, 20),
            terminal: towardTileEdge(2, 26)
        }
    },
    '1833ne:N25': {
        nodePositions: { 'city-0': towardTileEdge(5.5, 18), 'city-1': towardTileEdge(4, 20) }
    }
}

/**
 * Where each offboard prints its name, on one line, and the stack of its values beneath, beside
 * its spikes as the printed board has them. Eastern Townships prints one name across its two
 * hexes and one stack.
 */
const OffboardPrinting: Readonly<Record<string, { name?: Point; stack?: Point }>> = {
    A6: { name: { x: 0, y: -20 }, stack: { x: -14, y: 3.5 } },
    A12: { name: { x: -4, y: -20 }, stack: { x: -14, y: 3.5 } },
    A20: { name: { x: -6, y: -20 }, stack: { x: -14, y: 3.5 } },
    A24: { name: { x: 0, y: -20 }, stack: { x: -14, y: 3.5 } },
    A28: { name: { x: -4, y: -20 }, stack: { x: -14, y: 3.5 } },
    B17: { name: { x: -18, y: -24 }, stack: { x: -23, y: 0 } },
    F1: { name: { x: 45, y: 8 } },
    G2: { stack: { x: 4, y: -6 } },
    J11: { name: { x: 10, y: -20 }, stack: { x: 10, y: 6 } }
}

/** A point beside the board by column (A = 0) and row number, as the printed map numbers them. */
function besideBoard(column: number, row: number) {
    return calculateHexGeometry(
        { orientation: HexOrientation.Flat, dimensions: { radius: TileRadius } },
        { q: column, r: (row - column) / 2 }
    ).center
}

type Band = 'I-II' | 'III-IV' | 'V'
const Bands: readonly Band[] = ['I-II', 'III-IV', 'V']
const BandStages: Readonly<Record<Band, string>> = {
    'I-II': 'yellow',
    'III-IV': 'brown',
    V: 'gray'
}
function arrow(
    id: string,
    [column, row]: readonly [number, number],
    heading: string,
    footer: string,
    values: Partial<Record<Band, number>>,
    points: MapBonusArrow['points']
): MapBonusArrow {
    return {
        id,
        center: besideBoard(column, row),
        heading,
        footer,
        values: Bands.flatMap((band) => {
            const amount = values[band]
            return amount === undefined ? [] : [{ label: band, amount, stage: BandStages[band] }]
        }),
        points
    }
}

/**
 * The board's route bonus arrows where the printed map has them: one point for an
 * interconnection from its heading's place, two for a direct connection (p. 24).
 */
export const BonusArrows1833NE: readonly MapBonusArrow[] = [
    arrow(
        'montreal-portland',
        [-0.55, 1.9],
        'MONTREAL',
        'to PORTLAND',
        { 'I-II': 30, 'III-IV': 60, V: 40 },
        'right'
    ),
    arrow(
        'montreal-boston',
        [-0.55, 4],
        'MONTREAL',
        'to BOSTON',
        { 'I-II': 70, 'III-IV': 90 },
        'right'
    ),
    arrow(
        'ogdensburg-boston',
        [-0.55, 8.6],
        'OGDENSBURG RR',
        'to BOSTON',
        { 'I-II': 40, 'III-IV': 70 },
        'right'
    ),
    arrow('albany-troy-boston', [-0.3, 18], 'ALBANY/TROY', 'to BOSTON', { 'I-II': 50 }, 'right'),
    arrow(
        'boston-new-york',
        [-0.6, 26.1],
        'BOSTON and',
        'NEW YORK',
        { 'III-IV': 60, V: 80 },
        'both'
    ),
    arrow(
        'boston-north',
        [8.6, 21.5],
        'BOSTON to',
        'MONTREAL or OGDENSBURG',
        { 'I-II': 30, 'III-IV': 50 },
        'left'
    ),
    arrow(
        'boston-and-north',
        [10.45, 21.5],
        'BOSTON and',
        'MONTREAL or OGDENSBURG',
        { 'I-II': 50, 'III-IV': 60 },
        'both'
    ),
    arrow(
        'boston-and-albany-troy',
        [10.45, 23.5],
        'BOSTON and',
        'ALBANY/TROY',
        { 'I-II': 50 },
        'both'
    ),
    arrow(
        'portland-montreal',
        [9.55, 13.1],
        'PORTLAND',
        'to MONTREAL',
        { 'I-II': 30, 'III-IV': 60, V: 40 },
        'left'
    ),
    arrow(
        'montreal-port-city',
        [6.1, 29.2],
        'MONTREAL ending at',
        'NEW HAVEN or NORWICH',
        { 'III-IV': 50, V: 80 },
        'both'
    )
]

export const MapView1833NE: MapViewDefinition = {
    boardAreas: {
        market: { x: -60, y: -175, width: 1000, height: 150 },
        depot: { x: 760, y: 60, width: 381, height: 187 }
    },
    map: Map1833NE,
    tileSet: TileSet1833NE,
    bonusArrows: BonusArrows1833NE,
    layouts: {
        ...TileLayouts1833NE,
        G22: Boston,
        B3: Montreal,
        I14: Portland,
        ...Object.fromEntries(
            Object.entries(OffboardPrinting).map(([id, { stack }]) => [
                id,
                stack ? { revenuePositions: { offboard: stack } } : { hideRevenue: true as const }
            ])
        ),
        // The sea beyond the port cities pays nothing and prints no value.
        C28: { hideRevenue: true },
        E28: { hideRevenue: true },
        H25: { nodePositions: { 'city-0': towardTileEdge(3, 20), 'city-1': towardTileEdge(0, 14) } }
    },
    cityNames: {
        H25: { 'city-0': 'Plymouth', 'city-1': 'New Bedford' }
    },
    // The connection bonuses name these places, so the board prints them large (p. 24).
    offboardNames: { fontSize: 9, color: '#4a0b0b', serif: true },
    namePositions: Object.fromEntries(
        Object.entries(OffboardPrinting).flatMap(([id, { name }]) => (name ? [[id, name]] : []))
    ),
    hideLocationNames: Object.keys(OffboardPrinting).filter((id) => !OffboardPrinting[id].name),
    nameLines: Object.fromEntries(
        Object.keys(OffboardPrinting).flatMap((id) => {
            const name = Map1833NE.location(id).name
            return name ? [[id, [name]]] : []
        })
    ),
    revenueStack: 'column',
    revenueStageCaptions: { yellow: 'I-II', brown: 'III-IV', gray: 'V' },
    // A value for two phases is printed in both their colours.
    revenueStageColors: {
        yellow: [PhaseColors1833NE.I, PhaseColors1833NE.II],
        brown: [PhaseColors1833NE.III, PhaseColors1833NE.IV],
        gray: PhaseColors1833NE.V
    },
    markerArt: Object.fromEntries(
        ['P1', 'P2', 'P3'].map((id) => [`blocks-${id}`, { localLine: true, above: true }])
    ),
    stations: {
        'B&W': { color: '#ffffff', label: 'B&W' },
        'B&P': { color: '#eacd93', label: 'B&P' },
        'B&L': { color: '#f5abad', label: 'B&L' },
        FRR: { color: '#d1e088', label: 'Fitch' },
        HR: { color: '#c4e9fb', label: 'Hart' },
        RR: { color: '#2f7146', label: 'Rut' },
        CV: { color: '#0095da', label: 'CV' },
        'StL&A': { color: '#f38221', label: 'StL&A' },
        'A&StL': { color: '#8d807d', label: 'A&StL' }
    }
}

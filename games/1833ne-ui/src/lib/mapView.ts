import { Map1833NE, TileSet1833NE } from '@tabletop/1833ne'
import {
    StandardTileLayouts,
    towardTileEdge,
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

export const MapView1833NE: MapViewDefinition = {
    boardAreas: {
        market: { x: -60, y: -250, width: 1000, height: 150 },
        depot: { x: 760, y: 60, width: 381, height: 187 }
    },
    map: Map1833NE,
    tileSet: TileSet1833NE,
    layouts: {
        ...TileLayouts1833NE,
        G22: Boston,
        B3: Montreal,
        I14: Portland,
        H25: { nodePositions: { 'city-0': towardTileEdge(3, 20), 'city-1': towardTileEdge(0, 14) } }
    },
    cityNames: {
        H25: { 'city-0': 'Plymouth', 'city-1': 'New Bedford' }
    },
    revenueStageColors: {
        yellow: PhaseColors1833NE.I,
        brown: PhaseColors1833NE.III,
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

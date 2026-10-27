import { EighteenSeventeenMap, EighteenSeventeenTileSet } from '@tabletop/1817'
import { towardTileEdge, type MapViewDefinition } from '@tabletop/18xx-ui'

export const EighteenSeventeenMapView: MapViewDefinition = {
    // The market's tall cells span the map's width 16 units above its top row, as in 1846, and
    // the depot nestles in the notch below New York's row, both 12 map units clear of every hex.
    boardAreas: {
        market: { x: -26, y: -244, width: 1308, height: 178 },
        depot: { x: 922, y: 438, width: 381, height: 187 }
    },
    map: EighteenSeventeenMap,
    tileSet: EighteenSeventeenTileSet,
    locationMarkerNames: { mine: 'Mine', bridge: 'Bridge', ranch: 'Ranch' },
    layouts: {
        // Cleveland's two stations sit level and a little low, clear of its row of revenues.
        // Positions are given before the pointy tile's 30° turn.
        D9: { slotRowTurns: { city: -30 }, nodePositions: { city: { x: 2.5, y: 4.3 } } },
        E22: {
            nodePositions: { 'city-0': towardTileEdge(0, 18), 'city-1': towardTileEdge(3, 18) },
            // Given before the pointy tile's 30° turn: each city's revenue beside it, the upper
            // on the right with NY below it, which leaves the northwest corner for the lake.
            revenuePositions: { 'city-0': { x: -25.7, y: 19.5 }, 'city-1': { x: 25.6, y: -21.7 } },
            labelPosition: { x: 28.8, y: 1.9 }
        }
    },
    terrainPositions: { C8: { x: 0, y: -31 }, E22: { x: -26, y: -21 } },
    stations: {
        AS: { color: '#ee3e80', label: 'A&S' },
        AA: { color: '#904098', label: 'A&A' },
        BELT: { color: '#f2a847', label: 'Belt' },
        BESS: { color: '#16190e', label: 'Bess' },
        BA: { color: '#ef4223', label: 'B&A' },
        DLW: { color: '#984573', label: 'DL&W' },
        J: { color: '#bedb86', label: 'J' },
        GT: { color: '#e48329', label: 'GT' },
        H: { color: '#bedef3', label: 'H' },
        ME: { color: '#ffdea8', label: 'ME' },
        NYOW: { color: '#0095da', label: 'NYOW' },
        NYSW: { color: '#fff36b', label: 'NYSW' },
        PSNR: { color: '#0a884b', label: 'PSNR' },
        PLE: { color: '#00afad', label: 'PLE' },
        PW: { color: '#bec8cc', label: 'PW' },
        R: { color: '#165633', label: 'R' },
        SR: { color: '#e31f21', label: 'SR' },
        UR: { color: '#003d84', label: 'UR' },
        WT: { color: '#e96f2c', label: 'WT' },
        WC: { color: '#984d2d', label: 'WC' }
    }
}

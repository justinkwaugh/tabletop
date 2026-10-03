import { EighteenSeventeenMap, EighteenSeventeenTileSet } from '@tabletop/1817'
import { towardTileEdge, type MapViewDefinition } from '@tabletop/18xx-ui'

export const EighteenSeventeenMapView: MapViewDefinition = {
    // Fitted at TOP's market scale to keep every drawn market cell and the depot 12 map units
    // clear of every hex: the one-row market runs below the map, and the depot sits in the
    // map's empty lower-right corner above it.
    boardAreas: {
        market: { x: -240, y: 762, width: 1753, height: 70 },
        depot: { x: 800, y: 562, width: 381, height: 187 }
    },
    map: EighteenSeventeenMap,
    tileSet: EighteenSeventeenTileSet,
    locationMarkerNames: { mine: 'Mine', bridge: 'Bridge', ranch: 'Ranch' },
    layouts: {
        E22: {
            nodePositions: { 'city-0': towardTileEdge(0, 18), 'city-1': towardTileEdge(3, 18) }
        }
    },
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

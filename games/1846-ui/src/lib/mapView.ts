import { EighteenFortySixMap, EighteenFortySixTileSet, Corporations } from '@tabletop/1846'
import { towardTileEdge, type MapViewDefinition } from '@tabletop/18xx-ui'
export const BoardAreas = {
    market: { x: -40, y: -150, width: 1700, height: 73 },
    depot: { x: -40, y: -50, width: 250, height: 130 }
}
const colors = ['#267343', '#242424', '#2163a1', '#66b5d7', '#cfb22a', '#d13b35', '#bd6f2b']
export const MapView1846: MapViewDefinition = {
    map: EighteenFortySixMap,
    tileSet: EighteenFortySixTileSet,
    boardAreas: BoardAreas,
    stations: {
        ...Object.fromEntries(
            Corporations.map((company, index) => [
                company.id,
                { label: company.id, color: colors[index] }
            ])
        ),
        MS: { label: 'MS', color: '#8255a7' },
        BIG4: { label: 'B4', color: '#9c683d' }
    },
    layouts: {
        D6: {
            nodePositions: {
                'city-0': towardTileEdge(0, 25),
                'city-1': towardTileEdge(3, 25),
                'city-2': towardTileEdge(4, 25),
                'city-3': towardTileEdge(5, 25)
            }
        },
        C21: { hideRevenue: true },
        F22: { hideRevenue: true }
    },
    joinedEdges: { C21: [5], D22: [2], F22: [0], G21: [3] },
    revenueStageColors: { I: '#efd34b', II: '#5aa776', III: '#b8824c', IV: '#a7a7a7' }
}

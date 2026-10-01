import { EighteenThirtyMap, EighteenThirtyTileSet } from '@tabletop/1830'
import { towardTileEdge, type MapViewDefinition, type TileLayout } from '@tabletop/18xx-ui'

const separateCities: TileLayout = {
    nodePositions: { 'city-0': towardTileEdge(1, 16), 'city-1': towardTileEdge(4, 16) }
}

export const EighteenThirtyMapView: MapViewDefinition = {
    map: EighteenThirtyMap,
    tileSet: EighteenThirtyTileSet,
    layouts: {
        E5: separateCities,
        D10: separateCities,
        E11: separateCities,
        H18: separateCities,
        // New York's lower city sits beside its water marker rather than over it.
        G19: {
            nodePositions: { 'city-0': towardTileEdge(3, 20), 'city-1': towardTileEdge(1, 18) }
        },
        H12: { nodePositions: { city: towardTileEdge(2.5, 22) } }
    },
    stations: {
        PRR: { color: '#32763f', label: 'PRR' },
        NYC: { color: '#474548', label: 'NYC' },
        CPR: { color: '#d1232a', label: 'CPR' },
        BO: { color: '#025aaa', label: 'B&O' },
        CO: { color: '#add8e6', label: 'C&O' },
        ERIE: { color: '#fff500', label: 'Erie' },
        NYNH: { color: '#d88e39', label: 'NYNH' },
        BM: { color: '#95c054', label: 'B&M' }
    }
}

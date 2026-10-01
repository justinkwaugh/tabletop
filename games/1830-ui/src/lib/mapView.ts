import PRRLogo from './images/logos/PRR.svg'
import NYCLogo from './images/logos/NYC.svg'
import CPRLogo from './images/logos/CPR.svg'
import BOLogo from './images/logos/BO.svg'
import COLogo from './images/logos/CO.svg'
import ERIELogo from './images/logos/ERIE.svg'
import NYNHLogo from './images/logos/NYNH.svg'
import BMLogo from './images/logos/BM.svg'
import { EighteenThirtyMap, EighteenThirtyTileSet } from '@tabletop/1830'
import { towardTileEdge, type MapViewDefinition, type TileLayout } from '@tabletop/18xx-ui'

const separateCities: TileLayout = {
    nodePositions: { 'city-0': towardTileEdge(1, 16), 'city-1': towardTileEdge(4, 16) }
}

export const EighteenThirtyMapView: MapViewDefinition = {
    // Fitted at TOP's market scale to keep every drawn market cell and the depot 12 map units
    // clear of every hex: the map sits down and left in the market's empty lower-right staircase,
    // and the depot is top-aligned with the market, above the map's northeast.
    boardAreas: {
        market: { x: -454, y: -261, width: 1045, height: 668 },
        depot: { x: 602, y: -261, width: 381, height: 187 }
    },
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
        H12: { nodePositions: { city: towardTileEdge(2.5, 22) } },
        A9: { hideRevenue: true },
        I1: { hideRevenue: true }
    },
    joinedEdges: { A9: [4], A11: [1], I1: [5], J2: [2] },
    markerArt: Object.fromEntries(
        ['SV', 'CS', 'DH', 'MH', 'CA', 'BOP'].map((id) => [`blocks-${id}`, { localLine: true }])
    ),
    stations: {
        PRR: { color: '#32763f', label: 'PRR', imageUrl: PRRLogo },
        NYC: { color: '#000', label: 'NYC', imageUrl: NYCLogo },
        CPR: { color: '#d1232a', label: 'CPR', imageUrl: CPRLogo },
        BO: { color: '#025aaa', label: 'B&O', imageUrl: BOLogo },
        CO: { color: '#add8e6', label: 'C&O', imageUrl: COLogo },
        ERIE: { color: '#fff500', label: 'Erie', imageUrl: ERIELogo },
        NYNH: { color: '#ec7f05', label: 'NYNH', imageUrl: NYNHLogo },
        BM: { color: '#95c054', label: 'B&M', imageUrl: BMLogo }
    }
}

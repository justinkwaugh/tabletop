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

// Tile layouts are given before a pointy tile's 30° turn, so these land as drawn: centred under
// the cities, and up in the northeast corner.
const BottomCentre = { x: 15, y: 26 }
const NortheastCorner = { x: 20.6, y: -30.4 }
const separateCities: TileLayout = {
    nodePositions: { 'city-0': towardTileEdge(1, 19), 'city-1': towardTileEdge(4, 19) },
    labelPosition: BottomCentre
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
            nodePositions: { 'city-0': towardTileEdge(3, 20), 'city-1': towardTileEdge(1, 18) },
            revenuePositions: { 'city-0': NortheastCorner, 'city-1': { x: -18.4, y: 32.1 } },
            labelPosition: { x: 24.1, y: -2.3 }
        },
        H12: { nodePositions: { city: towardTileEdge(2.5, 22) } },
        A9: { hideRevenue: true },
        I1: { hideRevenue: true }
    },
    cityNames: {
        E5: { 'city-0': 'Windsor', 'city-1': 'Detroit' },
        D10: { 'city-0': 'Hamilton', 'city-1': 'Toronto' },
        E11: { 'city-0': 'Dunkirk', 'city-1': 'Buffalo' },
        H18: { 'city-0': 'Philadelphia', 'city-1': 'Trenton' },
        G19: { 'city-0': 'New York', 'city-1': 'Newark' }
    },
    // The label takes the bottom of these hexes.
    terrainHeights: { E5: -30, D10: -30 },
    joinedEdges: { A9: [4], A11: [1], I1: [5], J2: [2] },
    markerArt: Object.fromEntries(
        ['SV', 'CS', 'DH', 'MH', 'CA', 'BOP'].map((id) => [
            `blocks-${id}`,
            { localLine: true, above: true }
        ])
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

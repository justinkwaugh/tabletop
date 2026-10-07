import { EighteenThirtyTwoMap, EighteenThirtyTwoTileSet } from '@tabletop/1832'
import {
    StandardTileLayouts,
    towardTileEdge,
    type MapViewDefinition,
    type TileLayout
} from '@tabletop/18xx-ui'
import ACLLogo from './images/logos/ACL.svg'
import AWPLogo from './images/logos/AWP.svg'
import CGLogo from './images/logos/CG.svg'
import FECLogo from './images/logos/FEC.svg'
import GRRLogo from './images/logos/GRR.svg'
import GMOLogo from './images/logos/GMO.svg'
import LNLogo from './images/logos/LN.svg'
import NWLogo from './images/logos/NW.svg'
import SALLogo from './images/logos/SAL.svg'
import SOULogo from './images/logos/SOU.svg'

// Atlanta's cities sit apart toward their own track: one edge each on the printed hex, and on
// the green #190 toward one end of each straight line through the middle.
export const EighteenThirtyTwoTileLayouts: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    '1832:190': {
        nodePositions: {
            'city-0': towardTileEdge(2, 22),
            'city-1': towardTileEdge(0, 22),
            'city-2': towardTileEdge(4, 22)
        }
    }
}
const AtlantaPrinted: TileLayout = {
    nodePositions: {
        'city-0': towardTileEdge(4, 20),
        'city-1': towardTileEdge(0, 20),
        'city-2': towardTileEdge(2, 20)
    }
}

export const EighteenThirtyTwoMapView: MapViewDefinition = {
    map: EighteenThirtyTwoMap,
    tileSet: EighteenThirtyTwoTileSet,
    // At TOP's market scale the market's lower-right staircase steps down beside the map's
    // northwest, 12 map units clear of every hex, and the depot fills the corner above Richmond.
    boardAreas: {
        market: { x: -138, y: 566, width: 1314, height: 760 },
        depot: { x: 1200, y: 640, width: 381, height: 187 }
    },
    stations: {
        ACL: { label: 'ACL', color: '#b8347a', imageUrl: ACLLogo },
        AWP: { label: 'A&WP', color: '#8e5bb0', imageUrl: AWPLogo },
        CG: { label: 'CoG', color: '#2f9fb0', imageUrl: CGLogo },
        FEC: { label: 'FEC', color: '#e9c534', imageUrl: FECLogo },
        GRR: { label: 'GRR', color: '#8fcbea', imageUrl: GRRLogo },
        GMO: { label: 'GM&O', color: '#c8202f', imageUrl: GMOLogo },
        LN: { label: 'L&N', color: '#1b5cab', imageUrl: LNLogo },
        NW: { label: 'N&W', color: '#1a1a1a', imageUrl: NWLogo },
        SAL: { label: 'SAL', color: '#e8822a', imageUrl: SALLogo },
        SOU: { label: 'Sou', color: '#2f7d45', imageUrl: SOULogo }
    },
    layouts: { ...EighteenThirtyTwoTileLayouts, S22: AtlantaPrinted },
    markerArt: {
        port: { tileSymbol: 'port' },
        'medium-city': { hidden: true }
    }
}

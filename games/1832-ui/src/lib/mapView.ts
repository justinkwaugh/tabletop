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
import AMTKLogo from './images/logos/AMTK.svg'
import BNSFLogo from './images/logos/BNSF.svg'
import ICLogo from './images/logos/IC.svg'
import CSXLogo from './images/logos/CSX.svg'
import NSLogo from './images/logos/NS.svg'
import CottonToken from './images/tokens/cotton.svg'
import KeyWestToken from './images/tokens/key-west.svg'
import PortToken from './images/tokens/port.svg'

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

const Stations: MapViewDefinition['stations'] = {
    ACL: { label: 'ACL', color: '#b8347a', imageUrl: ACLLogo },
    AWP: { label: 'A&WP', color: '#8e5bb0', imageUrl: AWPLogo },
    CG: { label: 'CoG', color: '#2f9fb0', imageUrl: CGLogo },
    FEC: { label: 'FEC', color: '#e9c534', imageUrl: FECLogo },
    GRR: { label: 'GRR', color: '#8fcbea', imageUrl: GRRLogo },
    GMO: { label: 'GM&O', color: '#c8202f', imageUrl: GMOLogo },
    LN: { label: 'L&N', color: '#1b5cab', imageUrl: LNLogo },
    NW: { label: 'N&W', color: '#1a1a1a', imageUrl: NWLogo },
    SAL: { label: 'SAL', color: '#e8822a', imageUrl: SALLogo },
    SOU: { label: 'Sou', color: '#2f7d45', imageUrl: SOULogo },
    // Systems A–E (§11.6).
    AMTK: { label: 'AMTK', color: '#2a5a9e', imageUrl: AMTKLogo },
    BNSF: { label: 'BNSF', color: '#f2741c', imageUrl: BNSFLogo },
    IC: { label: 'IC', color: '#10803d', imageUrl: ICLogo },
    CSX: { label: 'CSX', color: '#1b3a6b', imageUrl: CSXLogo },
    NS: { label: 'NS', color: '#5a5a5a', imageUrl: NSLogo }
}

// A placed Port, Cotton or Key West token outlines its hex and badges it with the placing
// company's token and the token's own icon.
const PlacedTokens = {
    port: { name: 'Port', color: '#2f9bd6', imageUrl: PortToken },
    cotton: { name: 'Cotton', color: '#f2ecd6', imageUrl: CottonToken },
    'key-west': { name: 'Key West', color: '#1f8f6a', imageUrl: KeyWestToken }
} as const
const placedTokenKinds = Object.keys(Stations).flatMap((companyId) =>
    Object.entries(PlacedTokens).map(([kind, token]) => ({
        id: `${companyId}:${kind}`,
        companyId,
        token
    }))
)

export const EighteenThirtyTwoMapView: MapViewDefinition = {
    map: EighteenThirtyTwoMap,
    tileSet: EighteenThirtyTwoTileSet,
    // At TOP's market scale the market's lower-right staircase steps down beside the map's
    // northwest, 12 map units clear of every hex, and the depot fills the corner above Richmond.
    boardAreas: {
        market: { x: -138, y: 566, width: 1314, height: 760 },
        depot: { x: 1200, y: 640, width: 381, height: 187 }
    },
    stations: Stations,
    locationMarkerNames: {
        'medium-city': 'Medium city',
        ...Object.fromEntries(
            placedTokenKinds.map(({ id, companyId, token }) => [
                id,
                `${Stations[companyId].label} ${token.name}`
            ])
        )
    },
    layouts: { ...EighteenThirtyTwoTileLayouts, S22: AtlantaPrinted },
    markerArt: {
        port: { tileSymbol: 'port' },
        'medium-city': { townRing: true },
        ...Object.fromEntries(
            placedTokenKinds.map(({ id, companyId, token }) => [
                id,
                { placed: { color: token.color, companyId, icon: { imageUrl: token.imageUrl } } }
            ])
        )
    }
}

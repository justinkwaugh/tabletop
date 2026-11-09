import ECRLogo from './images/logos/ECR.svg'
import EHLogo from './images/logos/EH.svg'
import ENRLogo from './images/logos/ENR.svg'
import ESRLogo from './images/logos/ESR.svg'
import EURLogo from './images/logos/EUR.svg'
import FDRLogo from './images/logos/FDR.svg'
import IBLogo from './images/logos/IB.svg'
import LDLogo from './images/logos/LD.svg'
import LELogo from './images/logos/LE.svg'
import LHLogo from './images/logos/LH.svg'
import NBLogo from './images/logos/NB.svg'
import NELogo from './images/logos/NE.svg'
import NGCLogo from './images/logos/NGC.svg'
import NSLogo from './images/logos/NS.svg'
import SVRLogo from './images/logos/SVR.svg'
import WFLogo from './images/logos/WF.svg'
import WNRLogo from './images/logos/WNR.svg'
import WSTILogo from './images/logos/WSTI.svg'
import WVRLogo from './images/logos/WVR.svg'
import YNLogo from './images/logos/YN.svg'
import {
    Companies1862,
    LondonSpacesLocationId,
    LondonSpacesNodeId,
    Map1862,
    TileSet1862
} from '@tabletop/1862'
import {
    towardTileEdge,
    type MapViewDefinition,
    type StationAppearance,
    type TileLayout
} from '@tabletop/18xx-ui'

const Logos: Readonly<Record<string, string>> = {
    ECR: ECRLogo,
    EH: EHLogo,
    ENR: ENRLogo,
    ESR: ESRLogo,
    EUR: EURLogo,
    FDR: FDRLogo,
    IB: IBLogo,
    LD: LDLogo,
    LE: LELogo,
    LH: LHLogo,
    NB: NBLogo,
    NE: NELogo,
    NGC: NGCLogo,
    NS: NSLogo,
    SVR: SVRLogo,
    WF: WFLogo,
    WNR: WNRLogo,
    WSTI: WSTILogo,
    WVR: WVRLogo,
    YN: YNLogo
}

const Stations: Readonly<Record<string, StationAppearance>> = Object.fromEntries(
    Companies1862.map((company) => [
        company.id,
        { color: company.primaryColor, label: company.initials, imageUrl: Logos[company.id] }
    ])
)

const TowardEdge = 18
/** Each off-board area of a shared hex stands toward the edges its track leaves by. */
const areas = (positions: Readonly<Record<string, number>>): TileLayout => ({
    nodePositions: Object.fromEntries(
        Object.entries(positions).map(([area, edge]) => [area, towardTileEdge(edge, TowardEdge)])
    )
})

const Layouts: Readonly<Record<string, TileLayout>> = {
    A8: areas({ midlands: 4, west: 5 }),
    A12: areas({ west: 4, london: 5 }),
    F1: areas({ 'north-cromer': 0, 'north-wells': 1 }),
    I6: areas({ east: 1, 'north-east': 2 }),
    G14: areas({ holland: 2, denmark: 3 }),
    // London's four station spaces sit below its track (§7.6.5); its values print on the other
    // London hexes, clear of the spaces.
    [LondonSpacesLocationId]: {
        nodePositions: { london: towardTileEdge(3, 22), [LondonSpacesNodeId]: { x: 0, y: 14 } },
        hideRevenue: ['london', LondonSpacesNodeId]
    }
}

export const MapView1862: MapViewDefinition = {
    // The market's one long row runs above the map, 12 map units clear of Wells's top hex, and
    // the depot stands east of the map below it, clear of the North East and East ports.
    boardAreas: {
        // The market's four rows below the map, the depot in the open sea to its east.
        market: { x: -50, y: 712, width: 1052, height: 300 },
        depot: { x: 672, y: -43, width: 330, height: 640 }
    },
    map: Map1862,
    tileSet: TileSet1862,
    stations: Stations,
    layouts: Layouts
}

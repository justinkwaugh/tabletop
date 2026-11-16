import BBGLogo from './images/logos/BBG.svg'
import CALogo from './images/logos/CA.svg'
import CGRLogo from './images/logos/CGR.svg'
import CPRLogo from './images/logos/CPR.svg'
import CVLogo from './images/logos/CV.svg'
import GTLogo from './images/logos/GT.svg'
import GWLogo from './images/logos/GW.svg'
import LPSLogo from './images/logos/LPS.svg'
import TGBLogo from './images/logos/TGB.svg'
import THBLogo from './images/logos/THB.svg'
import WGBLogo from './images/logos/WGB.svg'
import WRLogo from './images/logos/WR.svg'
import {
    BbgId,
    CaId,
    CgrId,
    CprId,
    CvId,
    GtId,
    GwId,
    HamiltonLocationId,
    KitchenerLocationId,
    LpsId,
    MajorIds1856,
    Map1856,
    PortMarkerKind,
    Privates1856,
    destinationMarkerKind,
    destinationMarkers1856,
    TgbId,
    ThbId,
    TileSet1856,
    WaterlooId,
    TorontoLocationId,
    WellandLocationId,
    WgbId,
    WrId
} from '@tabletop/1856'
import {
    StandardTileLayouts,
    companyInitialsMark,
    towardTileEdge,
    type MapViewDefinition,
    type TileLayout
} from '@tabletop/18xx-ui'

/** Company colours, as their charters print them; the CGR's black. */
export const CompanyColors1856: Readonly<Record<string, string>> = {
    [BbgId]: '#ffd9eb',
    [CaId]: '#f72d2d',
    [CprId]: '#c474bc',
    [CvId]: '#2d0047',
    [GtId]: '#78c292',
    [GwId]: '#6e6966',
    [LpsId]: '#c3deeb',
    [TgbId]: '#c94d00',
    [ThbId]: '#ebff45',
    [WrId]: '#54230e',
    [WgbId]: '#494d99',
    [CgrId]: '#000000'
}

const Logos: Readonly<Record<string, string>> = {
    [BbgId]: BBGLogo,
    [CaId]: CALogo,
    [CprId]: CPRLogo,
    [CvId]: CVLogo,
    [GtId]: GTLogo,
    [GwId]: GWLogo,
    [LpsId]: LPSLogo,
    [TgbId]: TGBLogo,
    [ThbId]: THBLogo,
    [WrId]: WRLogo,
    [WgbId]: WGBLogo,
    [CgrId]: CGRLogo
}

// Toronto's two printed cities each face their one track, their values beside them.
const PrintedToronto: TileLayout = {
    nodePositions: { 'city-0': towardTileEdge(1, 19), 'city-1': towardTileEdge(4, 19) },
    revenuePositions: { 'city-0': { x: -25, y: 27 }, 'city-1': { x: 31, y: 10 } },
    labelPosition: towardTileEdge(0, 33)
}

// The printed OO hexes' cities, one low on the left and one high on the right, a full station
// circle apart; the label low on the right.
const PrintedOO: TileLayout = {
    nodePositions: { 'city-0': { x: -20, y: 10 }, 'city-1': { x: 6, y: -16 } },
    labelPosition: { x: 16, y: 20 }
}

// Hamilton prints its $40 at its foot, so its label takes the open upper left.
const PrintedHamilton: TileLayout = { ...PrintedOO, labelPosition: { x: -24, y: -17 } }

/**
 * Toronto's two-city tiles draw as the NY tiles of the same track; each label stands in the
 * most open space its tile's cities, values and track leave.
 */
const TitleTileLayouts: Readonly<Record<string, TileLayout>> = {
    '1856:120': { ...StandardTileLayouts['18xx:54'], labelPosition: { x: 26, y: 4 } },
    '1856:122': StandardTileLayouts['18xx:62'],
    '1856:121': { labelPosition: { x: 0, y: -29 } },
    '1856:123': { labelPosition: { x: 15, y: 33 } },
    '1856:125': { labelPosition: { x: 18, y: 27 } },
    '1856:126': { labelPosition: { x: -18, y: -30 } },
    '1856:127': { labelPosition: { x: 20, y: 22 } },
    // Toward the right corner, clear of the four spaces.
    '1856:124': { labelPosition: { x: 38, y: 0 } }
}

export const MapView1856: MapViewDefinition = {
    map: Map1856,
    tileSet: TileSet1856,
    // At TOP's market scale the market stands above the map, its column of low prices down the
    // empty corner west of Lake Huron; the depot sits under the Lake Erie shore, in the lower left.
    boardAreas: {
        market: { x: -80, y: -255, width: 1252, height: 760 },
        depot: { x: 290, y: 835, width: 381, height: 187 }
    },
    stations: Object.fromEntries(
        Object.entries(CompanyColors1856).map(([companyId, color]) => [
            companyId,
            { label: companyId, color, imageUrl: Logos[companyId] }
        ])
    ),
    terrainCostPrefix: '$',
    // Port Huron and Sarnia, the Canadian West, Lower Canada and Buffalo each print as one red
    // area over two hexes.
    joinedEdges: {
        A14: [4],
        B13: [1],
        N1: [5],
        O2: [2],
        Q8: [0],
        Q10: [3],
        P17: [0],
        P19: [3]
    },
    // Each joined area prints its name and values once.
    hideLocationNames: ['N1', 'Q10', 'P19'],
    layouts: {
        ...StandardTileLayouts,
        ...TitleTileLayouts,
        [TorontoLocationId]: PrintedToronto,
        [HamiltonLocationId]: PrintedHamilton,
        [KitchenerLocationId]: PrintedOO,
        [WellandLocationId]: PrintedOO,
        N1: { hideRevenue: true },
        Q10: { hideRevenue: true },
        P19: { hideRevenue: true }
    },
    markerArt: {
        ...Object.fromEntries(
            Privates1856.filter((company) => company.blocks).map((company) => [
                `blocks-${company.id}`,
                { localLine: true, above: true }
            ])
        ),
        // Kitchener's high city leaves no room above it, so its line runs low, clear of the label.
        [`blocks-${WaterlooId}`]: { localLine: true, at: { x: -6, y: 33 } },
        port: { revenueSymbol: 'port' },
        [PortMarkerKind]: {
            token: { imageUrl: companyInitialsMark('+20'), place: { covers: 'port' } }
        },
        // A company's destination shows its initials beside the place until it is reached, or no
        // longer matters (Destination).
        ...Object.fromEntries(
            MajorIds1856.map((companyId) => [
                destinationMarkerKind(companyId),
                { token: { imageUrl: companyInitialsMark(companyId), place: 'corner' as const } }
            ])
        )
    },
    stateMarkers: destinationMarkers1856,
    locationMarkerNames: {
        port: 'Anchor: the Great Lakes Shipping Company’s port may be placed here.',
        [PortMarkerKind]: 'Port token: $20 more for the company it serves.',
        ...Object.fromEntries(
            MajorIds1856.map((companyId) => [
                destinationMarkerKind(companyId),
                `${companyId} destination`
            ])
        )
    }
}

import BMLogo from './images/logos/BM.svg'
import BOLogo from './images/logos/BO.svg'
import COLogo from './images/logos/CO.svg'
import CPRLogo from './images/logos/CPR.svg'
import GTLogo from './images/logos/GT.svg'
import ERIELogo from './images/logos/ERIE.svg'
import ICLogo from './images/logos/IC.svg'
import MCLogo from './images/logos/MC.svg'
import MPLogo from './images/logos/MP.svg'
import NYCLogo from './images/logos/NYC.svg'
import NKPLogo from './images/logos/NKP.svg'
import NYHLogo from './images/logos/NYH.svg'
import NWLogo from './images/logos/NW.svg'
import OSHLogo from './images/logos/OSH.svg'
import PRRLogo from './images/logos/PRR.svg'
import WABLogo from './images/logos/WAB.svg'
import CPRYLogo from './images/logos/CPRY.svg'
import BlockingArt from './images/tokens/blocking.svg'
import CoalArt from './images/tokens/coal.svg'
import type { Point } from '@tabletop/common'
import {
    CoalMarkerCount,
    CoalfieldsLocationId,
    Map1828,
    PeterboroughLocationId,
    PrivateBlocks1828,
    TileSet1828,
    TitleRules1828,
    TunnelLocationId,
    coalfieldsMarkers,
    tunnelHoldsCoal
} from '@tabletop/1828'
import {
    StandardTileLayouts,
    towardTileEdge,
    type MapMarkerArt,
    type MapViewDefinition,
    type StateMarker,
    type TileLayout
} from '@tabletop/18xx-ui'
import { CompanyNames1828 } from './companyPresentation.js'
import { PhaseColors1828 } from './trainPresentation.js'

export const CompanyColors1828: Readonly<Record<string, string>> = {
    BM: '#446ccf',
    BO: '#4682b4',
    CO: '#b0e0e6',
    CPR: '#9c661f',
    GT: '#f0e68c',
    ERIE: '#b8860b',
    IC: '#9acd32',
    MC: '#b3b3b3',
    MP: '#bdb76b',
    NYC: '#7f7f7f',
    NKP: '#d8bfd8',
    NYH: '#d2b48c',
    NW: '#f08080',
    OSH: '#61b329',
    PRR: '#ff6347',
    WAB: '#dda0dd',
    CPRY: '#7f7f7f'
}

const Logos: Readonly<Record<string, string>> = {
    BM: BMLogo,
    BO: BOLogo,
    CO: COLogo,
    CPR: CPRLogo,
    GT: GTLogo,
    ERIE: ERIELogo,
    IC: ICLogo,
    MC: MCLogo,
    MP: MPLogo,
    NYC: NYCLogo,
    NKP: NKPLogo,
    NYH: NYHLogo,
    NW: NWLogo,
    OSH: OSHLogo,
    PRR: PRRLogo,
    WAB: WABLogo,
    CPRY: CPRYLogo
}

/** The coal markers on the Virginia Coalfields, each its own kind so each keeps its place. */
const CoalfieldsMarkerKinds = Array.from(
    { length: CoalMarkerCount },
    (_, index) => `coal-${index + 1}`
)
const TunnelMarkerKind = 'tunnel-coal'

const CoalfieldsMarkerPoints: readonly Point[] = [
    { x: -20, y: 24 },
    { x: 20, y: 24 },
    { x: 0, y: 34 }
]

/** The coal markers still on the Coalfields and the tunnel (§4, §16). */
export function coalMarkers1828(state: object): StateMarker[] {
    const tunnel = tunnelHoldsCoal(state)
    return [
        ...CoalfieldsMarkerKinds.slice(0, coalfieldsMarkers(state)).map((kind) => ({
            locationId: CoalfieldsLocationId,
            kind
        })),
        ...(tunnel ? [{ locationId: TunnelLocationId, kind: TunnelMarkerKind }] : [])
    ]
}

// Positions are given before the pointy tile's 30° turn, toward the flat hex's edges.
const twoCities = (
    first: Point,
    second: Point,
    annotations: Omit<TileLayout, 'nodePositions'> = {}
): TileLayout => ({
    nodePositions: { 'city-0': first, 'city-1': second },
    ...annotations
})

/** The printed OO hexes' two cities side by side, as the board prints them, OO below. */
const PrintedOO = twoCities(towardTileEdge(1, 19), towardTileEdge(4, 19), {
    labelPosition: towardTileEdge(5.5, 30)
})

/** A point on the drawn pointy hex, turned back by the 30° its layout positions turn. */
const onDrawnHex = ({ x, y }: Point): Point => ({
    x: x * Math.cos(Math.PI / 6) + y * Math.sin(Math.PI / 6),
    y: y * Math.cos(Math.PI / 6) - x * Math.sin(Math.PI / 6)
})

/**
 * New York's cities on their tracks: Newark to the southwest, New York (the NYH's) northeast. The
 * label and values stand in the space beside them, leaving the lower right for the water cost.
 */
const PrintedNewYork = twoCities(towardTileEdge(0, 22), towardTileEdge(3, 15), {
    labelPosition: onDrawnHex({ x: -27, y: -16 }),
    revenuePositions: {
        'city-0': onDrawnHex({ x: -32, y: 2 }),
        'city-1': onDrawnHex({ x: 30, y: 2 })
    }
})

const OffboardNameAbove: Point = { x: 0, y: -11 }
const OffboardNameBelow: Point = { x: 0, y: 17 }

/** Each red offboard's name, above or below its value, on the side the board prints it. */
const OffboardNamePositions: Readonly<Record<string, Point>> = {
    A3: OffboardNameBelow,
    B28: OffboardNameAbove,
    G3: OffboardNameAbove,
    I1: { x: -12, y: OffboardNameAbove.y },
    K3: OffboardNameBelow,
    L16: OffboardNameBelow
}

const coalToken = (at: Point): MapMarkerArt => ({
    token: { imageUrl: CoalArt, place: { near: at } }
})

const CanadaWestSpikes: NonNullable<TileLayout['printedPaths']> = Object.fromEntries(
    Map1828.location('A13').preprintedTile.paths.map((path) => [path.id, 'spike' as const])
)

export const MapView1828: MapViewDefinition = {
    map: Map1828,
    tileSet: TileSet1828,
    // East of the map at TOP's market scale, top-aligned with it; the depot stands in the map's
    // empty lower right, below Atlantic City and east of Norfolk.
    boardAreas: {
        market: { x: 1230, y: -50, width: 942, height: 1236 },
        depot: { x: 840, y: 690, width: 381, height: 187 }
    },
    stations: Object.fromEntries(
        Object.entries(CompanyColors1828).map(([companyId, color]) => [
            companyId,
            {
                label: CompanyNames1828[companyId].initials,
                color,
                imageUrl: Logos[companyId]
            }
        ])
    ),
    // An absorbed shell's, an unparred company's or the C&P's station left on the map blocks its
    // city (§7.5.2, §13.2.2.5, §17.7).
    closedCompanyStation: { label: 'Blocking', color: '#010101', imageUrl: BlockingArt },
    // A hex's two towns or cities, one to a line, and each offboard's on one, as the board prints them.
    nameLines: Object.fromEntries(
        Map1828.definition.locations.flatMap(({ id, name }) =>
            name && (name.includes('/') || id in OffboardNamePositions)
                ? [[id, name.split('/')]]
                : []
        )
    ),
    offboardNames: { fontSize: 9, color: '#4a0b0b', wordSpacing: 0.2 },
    namePositions: OffboardNamePositions,
    nameOffsets: { G23: { x: 0, y: -2 } },
    terrainCostPrefix: TitleRules1828.currencySymbol,
    revenueStageColors: { yellow: PhaseColors1828['2'], brown: PhaseColors1828['3+D'] },
    // Canada prints as one red area over two hexes.
    joinedEdges: { A13: [4], A15: [1] },
    // Water costs clear of the cities: above Hamilton/Toronto's and Detroit/Windsor's, the OO
    // below them as the board prints it, right of Peterborough's track, and right of Newark, its
    // symbol under the cost to fit.
    terrainPositions: {
        [PeterboroughLocationId]: { x: 14, y: 21 },
        D14: { x: 0, y: -21 },
        E9: { x: 0, y: -21 },
        G23: { x: 19, y: 16 }
    },
    terrainSymbolsBelow: ['G23'],
    nameTurns: { [PeterboroughLocationId]: 0 },
    layouts: {
        ...StandardTileLayouts,
        D14: PrintedOO,
        E9: PrintedOO,
        E15: PrintedOO,
        H22: PrintedOO,
        G23: PrintedNewYork,
        // Canada prints spikes, not track: a route may only start or end there (§11).
        A13: { printedPaths: CanadaWestSpikes },
        A15: { printedPaths: { 'edge-0': 'spike', 'edge-1': 'hidden', 'edge-5': 'spike' } },
        ...Object.fromEntries(
            Object.keys(OffboardNamePositions).map((id) => [
                id,
                { revenuePositions: { offboard: { x: 0, y: 0 } }, revenueStack: 'row' as const }
            ])
        )
    },
    markerArt: {
        ...Object.fromEntries(
            Object.keys(PrivateBlocks1828).map((id) => [
                `blocks-${id}`,
                { localLine: true, above: true }
            ])
        ),
        ...Object.fromEntries(
            CoalfieldsMarkerKinds.map((kind, index) => [
                kind,
                coalToken(CoalfieldsMarkerPoints[index])
            ])
        ),
        [TunnelMarkerKind]: coalToken({ x: -25, y: -3 })
    },
    stateMarkers: coalMarkers1828,
    locationMarkerNames: {
        ...Object.fromEntries(
            CoalfieldsMarkerKinds.map((kind) => [
                kind,
                'Coal marker: a company reaching the Coalfields may buy it for $120.'
            ])
        ),
        [TunnelMarkerKind]: 'Coal marker: taken by the company that builds the tunnel.'
    }
}

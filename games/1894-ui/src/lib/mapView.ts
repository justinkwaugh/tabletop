import PLMLogo from './images/logos/PLM.svg'
import CFORLogo from './images/logos/CFOR.svg'
import NordLogo from './images/logos/Nord.svg'
import OuestLogo from './images/logos/Ouest.svg'
import EstLogo from './images/logos/Est.svg'
import AGLogo from './images/logos/AG.svg'
import BelgeLogo from './images/logos/Belge.svg'
import LFLogo from './images/logos/LF.svg'
import LBLogo from './images/logos/LB.svg'
import { EighteenNinetyFourMap, EighteenNinetyFourTileSet } from '@tabletop/1894'
import type { Point } from '@tabletop/common'
import { towardTileEdge, type MapViewDefinition, type TileLayout } from '@tabletop/18xx-ui'

const BottomCentre = { x: 15, y: 26 }
const cities = (first: Point, second: Point): TileLayout => ({
    nodePositions: { 'city-0': first, 'city-1': second }
})
const towns = (first: Point, second: Point): TileLayout => ({
    nodePositions: { 'town-0': first, 'town-1': second }
})
// Paris's untiled cities sit side by side, the PLM's marked city on the left.
const paris: TileLayout = {
    ...cities(towardTileEdge(1, 19), towardTileEdge(4, 19)),
    labelPosition: BottomCentre
}

/**
 * Two-city tiles, by tile: Paris's tiles keep the PLM's city at the corner of its first two
 * edges, and each split city sits on its own track clear of the other (§12.2, §21.1).
 */
export const EighteenNinetyFourTileLayouts: Readonly<Record<string, TileLayout>> = {
    '1894:X1': cities(towardTileEdge(0.5, 22), towardTileEdge(3, 20)),
    '1894:X4': cities(towardTileEdge(0.5, 22), towardTileEdge(2.5, 22)),
    '1894:X5': cities(towardTileEdge(0.5, 22), towardTileEdge(3.5, 22)),
    '1894:X9': cities(towardTileEdge(0.5, 22), towardTileEdge(2.5, 20)),
    '1894:X10': cities(towardTileEdge(0.5, 22), towardTileEdge(3.5, 20)),
    '1894:X11': cities(towardTileEdge(0.5, 22), towardTileEdge(2.5, 22)),
    '1894:X12': cities(towardTileEdge(0.5, 22), towardTileEdge(3.5, 22)),
    '1894:X16': cities(towardTileEdge(0, 14), towardTileEdge(4, 14)),
    '1894:X17': cities(towardTileEdge(2, 20), towardTileEdge(5, 20)),
    '1894:X18': cities(towardTileEdge(0.5, 24), towardTileEdge(3.5, 24)),
    '1894:X19': cities(towardTileEdge(2, 23), towardTileEdge(1, 23)),
    '1894:X20': cities({ x: 0, y: 0 }, towardTileEdge(1.5, 26)),
    '1894:X21': cities(towardTileEdge(0.5, 24), towardTileEdge(2.5, 24)),
    '1894:X22': cities(towardTileEdge(0, 6), towardTileEdge(3, 22)),
    '1894:X23': cities(towardTileEdge(1, 20), towardTileEdge(3.5, 24)),
    '1894:X24': cities(towardTileEdge(5, 20), towardTileEdge(2.5, 24))
}

export const EighteenNinetyFourMapView: MapViewDefinition = {
    // The map fills its rectangle, so the market stands to its east at TOP's market scale, top
    // aligned and clear of the Netherlands and Luxembourg; the depot sits in the market's empty
    // lower-right staircase.
    boardAreas: {
        market: { x: 880, y: -50, width: 774, height: 669 },
        depot: { x: 1330, y: 380, width: 381, height: 187 }
    },
    map: EighteenNinetyFourMap,
    tileSet: EighteenNinetyFourTileSet,
    layouts: {
        ...EighteenNinetyFourTileLayouts,
        G6: paris,
        // Abbeville and Pont-Remy have printed track to one side.
        C6: towns(towardTileEdge(2, 16), towardTileEdge(5, 16)),
        D7: towns(towardTileEdge(5, 16), towardTileEdge(2, 16)),
        I18: { hideRevenue: true }
    },
    cityNames: { G6: { 'city-0': 'Paris (PLM)', 'city-1': 'Paris' } },
    markerArt: Object.fromEntries(
        ['LRC', 'GLG', 'SAC'].map((id) => [`blocks-${id}`, { localLine: true, above: true }])
    ),
    stations: {
        PLM: { color: '#dda0dd', label: 'PLM', imageUrl: PLMLogo },
        CFOR: { color: '#9c661f', label: 'CFOR', imageUrl: CFORLogo },
        Nord: { color: '#ff4040', label: 'Nord', imageUrl: NordLogo },
        Ouest: { color: '#4682b4', label: 'Ouest', imageUrl: OuestLogo },
        Est: { color: '#ff9966', label: 'Est', imageUrl: EstLogo },
        AG: { color: '#fcf75e', label: 'AG', imageUrl: AGLogo },
        Belge: { color: '#61b229', label: 'Belge', imageUrl: BelgeLogo },
        LF: { color: '#ffc0cb', label: 'LF', imageUrl: LFLogo },
        LB: { color: '#c9c9c9', label: 'LB', imageUrl: LBLogo }
    }
}

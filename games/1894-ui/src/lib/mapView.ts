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
 * edges, and each split city sits on its own track clear of the other (§12.2, §21.1). On tiles
 * whose tracks cross or run close, the cities stand far enough along them to keep their full size.
 */
export const EighteenNinetyFourTileLayouts: Readonly<Record<string, TileLayout>> = {
    '1894:X1': cities(towardTileEdge(0.5, 22), towardTileEdge(3, 20)),
    '1894:X4': cities(towardTileEdge(0.5, 22), towardTileEdge(2.5, 22)),
    '1894:X5': cities(towardTileEdge(0.5, 22), towardTileEdge(3.5, 22)),
    // A two-space city runs along the hex edge it faces, as on 1850's green Chicago tile.
    '1894:X9': {
        ...cities(towardTileEdge(0.5, 21), towardTileEdge(3, 19)),
        revenuePositions: { 'city-0': { x: -35, y: 0 }, 'city-1': { x: 33, y: 0 } },
        labelPosition: { x: 20, y: 26 }
    },
    '1894:X10': {
        ...cities(towardTileEdge(0.5, 21), towardTileEdge(4, 19)),
        slotRowTurns: { 'city-1': 60 }
    },
    '1894:X11': cities(towardTileEdge(0.5, 22), towardTileEdge(2.5, 22)),
    '1894:X12': cities(towardTileEdge(0.5, 22), towardTileEdge(3.5, 22)),
    '1894:X16': cities({ x: 0, y: 26.8 }, { x: 23.2, y: -13.4 }),
    '1894:X17': cities({ x: -4.7, y: -17.2 }, { x: 4.7, y: 17.2 }),
    '1894:X18': cities(towardTileEdge(0.5, 24), towardTileEdge(3.5, 24)),
    '1894:X19': cities({ x: -2.2, y: -25.4 }, { x: -2.2, y: 25.4 }),
    '1894:X20': cities({ x: 0, y: 24.2 }, { x: -25.4, y: -4.7 }),
    '1894:X21': cities(towardTileEdge(0.5, 24), towardTileEdge(2.5, 24)),
    '1894:X22': cities({ x: 0, y: 18 }, { x: 22.4, y: -15 }),
    '1894:X23': cities({ x: -10, y: 5.8 }, { x: 12.5, y: -21.6 }),
    '1894:X24': cities({ x: 10, y: 5.8 }, { x: -12.5, y: -21.6 })
}

/**
 * Two stations sharing a split city's one space (§7.3.8, §21.2) stand as a two-space city, in a
 * row along the hex edge it faces wherever that fits the tile.
 */
const sharedCity = (nodeId: string, position: Point, turn: number): TileLayout => ({
    nodePositions: { [nodeId]: position },
    slotRowTurns: { [nodeId]: turn }
})
export const EighteenNinetyFourSharedCityLayouts: Readonly<
    Record<string, Readonly<Record<string, TileLayout>>>
> = {
    '1894:X16': {
        'city-0': sharedCity('city-0', towardTileEdge(0, 25.5), 0),
        'city-1': sharedCity('city-1', towardTileEdge(4, 25.5), 60)
    },
    '1894:X17': {
        'city-0': sharedCity('city-0', towardTileEdge(2, 21.5), 120),
        'city-1': sharedCity('city-1', towardTileEdge(5, 21.5), 120)
    },
    '1894:X18': {
        'city-0': sharedCity('city-0', towardTileEdge(1, 16.5), 60),
        'city-1': sharedCity('city-1', towardTileEdge(3, 16.5), 0)
    },
    '1894:X19': {
        'city-0': sharedCity('city-0', towardTileEdge(4, 20), 60),
        'city-1': sharedCity('city-1', towardTileEdge(5, 20), 120)
    },
    '1894:X20': {
        'city-0': sharedCity('city-0', towardTileEdge(5, 13.5), 120),
        'city-1': sharedCity('city-1', towardTileEdge(2, 25.5), 120)
    },
    '1894:X21': {
        'city-0': sharedCity('city-0', towardTileEdge(0, 16.5), 0),
        'city-1': sharedCity('city-1', towardTileEdge(3, 16.5), 0)
    },
    '1894:X22': {
        'city-0': sharedCity('city-0', towardTileEdge(0, 19.5), 0),
        'city-1': sharedCity('city-1', towardTileEdge(4, 25.5), 60)
    },
    '1894:X23': {
        'city-0': sharedCity('city-0', towardTileEdge(0, 16), 0),
        'city-1': sharedCity('city-1', towardTileEdge(4, 20.5), 60)
    },
    '1894:X24': {
        'city-0': sharedCity('city-0', towardTileEdge(0, 16), 0),
        'city-1': sharedCity('city-1', towardTileEdge(2, 20.5), 120)
    }
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
        A4: { revenuePositions: { offboard: { x: 0, y: 0 } } },
        // Beside its town's bar, which the printed track carries off the hex's centre.
        A8: { revenuePositions: { town: { x: -6.9, y: -4 } } },
        H3: { revenuePositions: { city: { x: 15.5, y: 26.85 } } },
        I18: { hideRevenue: true, revenuePositions: { offboard: { x: 16, y: -8 } } }
    },
    cityNames: { G6: { 'city-0': 'Paris (PLM)', 'city-1': 'Paris' } },
    borderWidths: { province: 4 },
    sharedCityLayouts: EighteenNinetyFourSharedCityLayouts,
    // Chartres's track leaves over the city, so its name reads along the city's foot.
    namesBelow: ['H3'],
    offboardNames: { fontSize: 8.5, color: '#4a0b0b' },
    nameStyles: { A10: { fontSize: 9, color: '#102a3a' } },
    // Names print where the pointy hex is wide enough, clear of the offboards' track.
    namePositions: {
        A4: { x: 0, y: -28 },
        A10: { x: 0, y: -27 },
        C18: { x: 0, y: -24 },
        I2: { x: 17, y: -20 },
        I18: { x: 0, y: 28 }
    },
    nameLines: {
        A8: ['Boulogne-', 'sur-Mer'],
        C6: ['Blangy-sur-', 'Bresle &', 'Abbeville'],
        G12: ['Caudry &', 'Maubeuge'],
        I2: ['Centre &', 'Bourgogne']
    },
    markerArt: {
        ...Object.fromEntries(
            ['LRC', 'GLG', 'SAC'].map((id) => [`blocks-${id}`, { localLine: true, above: true }])
        ),
        SQG: { localLine: true, onTile: true },
        largest: { revenueBox: true },
        ferry: { note: { at: { x: 0, y: 28 }, fontSize: 9 } },
        // Too long to read inside the hex, so it prints on the table above it.
        'netherlands-bonus': {
            note: {
                at: { x: 0, y: -66 },
                fontSize: 9,
                lines: ['Netherlands', '+₣100 to offboard'],
                offHex: true
            }
        }
    },
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

import { EighteenFortySixMap, EighteenFortySixTileSet, Corporations } from '@tabletop/1846'
import PRRLogo from './images/logos/PRR.svg'
import NYCLogo from './images/logos/NYC.svg'
import BOLogo from './images/logos/BO.svg'
import COLogo from './images/logos/CO.svg'
import ErieLogo from './images/logos/ERIE.svg'
import GTLogo from './images/logos/GT.svg'
import ICLogo from './images/logos/IC.svg'
import MSLogo from './images/logos/MS.svg'
import Big4Logo from './images/logos/B4.svg'
import {
    createMapDrawing,
    towardTileEdge,
    StandardTileLayouts,
    type TileLayout,
    type MapViewDefinition
} from '@tabletop/18xx-ui'
const ChicagoLayout: TileLayout = {
    nodePositions: {
        // Out near the edges so four full-size stations fit, with little track showing.
        'city-0': towardTileEdge(0, 29),
        'city-1': towardTileEdge(3, 29),
        'city-2': towardTileEdge(4, 29),
        'city-3': towardTileEdge(5, 29)
    },
    // The four cities always share one revenue, shown once beside the label in the open west.
    hideRevenue: ['city-1', 'city-2', 'city-3'],
    revenuePositions: { 'city-0': { x: -35, y: 1 } },
    labelPosition: { x: -23, y: 19 }
}
export const TileLayouts1846: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    '1846:298': ChicagoLayout,
    '1846:299': ChicagoLayout,
    '1846:300': ChicagoLayout
}
// Tile layouts are given before a pointy tile's 30° turn, so this lands above the bottom vertex.
const SouthCorner = { x: 18, y: 31.2 }
// Map symbol positions are on the drawn hex, so a pointy tile's northeast corner is direct.
const NortheastCorner = { x: 28.6, y: -16.5 }
const SoutheastCorner = { x: 28.6, y: 16.5 }
const mapLayouts: Readonly<Record<string, TileLayout>> = {
    ...TileLayouts1846,
    // Every offboard but Louisville stacks its revenues, with any bonus badge, beside the middle
    // of its east edge.
    ...Object.fromEntries(
        EighteenFortySixMap.definition.locations
            .filter(
                (location) =>
                    location.id !== 'J10' &&
                    location.preprintedTile.nodes.some((node) => node.kind === 'offboard')
            )
            .map((location): [string, TileLayout] => [
                location.id,
                {
                    revenueStack: 'column',
                    revenueAlign: 'middle',
                    // E and W sit in the south corner.
                    ...(location.preprintedTile.labels.length ? { labelPosition: SouthCorner } : {})
                }
            ])
    ),
    D6: ChicagoLayout,
    // Cumberland's track enters from the northwest, so its revenues keep to the east like the rest.
    H20: {
        revenueStack: 'column',
        revenueAlign: 'middle',
        revenuePositions: { offboard: { x: 24.2, y: -14 } },
        labelPosition: SouthCorner
    },
    // Detroit's Z sits a little east of where it would fall.
    C15: { labelPosition: { x: 18, y: -27.8 } },
    C21: { hideRevenue: true },
    F22: { hideRevenue: true }
}
const mapBounds = createMapDrawing(EighteenFortySixMap, undefined, { layouts: mapLayouts }).bounds
// The depot fills the map's empty northwest corner, 12 map units clear of the C5 and E5 hexes,
// and the market spans the depot and map together.
const depot = { x: -270, y: mapBounds.y, width: 387, height: 347 }
const marketHeight = 152
export const BoardAreas = {
    market: {
        x: depot.x,
        y: mapBounds.y - 16 - marketHeight,
        width: mapBounds.x + mapBounds.width - depot.x,
        height: marketHeight
    },
    depot
}
export const MapView1846: MapViewDefinition = {
    map: EighteenFortySixMap,
    tileSet: EighteenFortySixTileSet,
    boardAreas: BoardAreas,
    locationMarkerNames: {
        ...Object.fromEntries(
            [...Corporations.map((company) => company.id), 'MS', 'BIG4'].flatMap((companyId) =>
                ['SC', 'MPC', 'BT'].map((privateId) => [
                    `${companyId}:${privateId}`,
                    `${companyId} ${privateId === 'SC' ? 'Steamboat' : privateId === 'MPC' ? 'Meat Packing' : 'Boomtown'}`
                ])
            )
        ),
        ...Object.fromEntries(
            Corporations.map((company) => [
                `${company.id}:blocking`,
                `${company.id} blocking station`
            ])
        )
    },
    stations: {
        PRR: { label: 'PRR', color: '#c8202f', imageUrl: PRRLogo },
        NYC: { label: 'NYC', color: '#171717', imageUrl: NYCLogo },
        'B&O': { label: 'B&O', color: '#025aaa', imageUrl: BOLogo },
        'C&O': { label: 'C&O', color: '#add8e6', imageUrl: COLogo },
        ERIE: { label: 'Erie', color: '#fff500', imageUrl: ErieLogo },
        GT: { label: 'GT', color: '#f58121', imageUrl: GTLogo },
        IC: { label: 'IC', color: '#32763f', imageUrl: ICLogo },
        'C&WI': { label: 'C&WI', color: '#666666' },
        MS: { label: 'MS', color: '#f3a7b8', imageUrl: MSLogo },
        BIG4: { label: 'B4', color: '#41c8dc', imageUrl: Big4Logo }
    },
    layouts: mapLayouts,
    joinedEdges: { C21: [5], D22: [2], F22: [0], G21: [3] },
    // Huntington's track leaves over its top, so its name curves under the city.
    namesBelow: ['I15'],
    // Chicago's Chi already names it.
    hideLocationNames: ['D6'],
    // Ports take northeast corners, and Holland's pair sits above its spike. Meat packing takes
    // St. Louis's southeast corner and the middle of Chicago.
    symbolPositions: {
        I1: { ports: NortheastCorner, 'meat-packing': SoutheastCorner },
        D6: { 'meat-packing': { x: 0, y: 0 } },
        C5: NortheastCorner,
        D14: NortheastCorner,
        // Wheeling's second port continues up the line of its northeast edge.
        G19: [NortheastCorner, { x: 12.7, y: -25.7 }],
        B8: { x: 20, y: -15 }
    },
    markerArt: {
        IC: { centeredLabel: true },
        'east-west': { revenueBadge: true, arrows: true },
        ports: { revenueSymbol: 'port' },
        'meat-packing': { revenueSymbol: 'horns' }
    }
}

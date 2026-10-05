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
        'city-0': towardTileEdge(0, 25),
        'city-1': towardTileEdge(3, 25),
        'city-2': towardTileEdge(4, 25),
        'city-3': towardTileEdge(5, 25)
    },
    revenuePositions: {
        'city-0': { x: -17, y: 25 },
        'city-1': { x: -17, y: -25 },
        'city-2': { x: -30, y: 0 },
        'city-3': { x: 32, y: 0 }
    }
}
export const TileLayouts1846: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    '1846:298': ChicagoLayout,
    '1846:299': ChicagoLayout,
    '1846:300': ChicagoLayout
}
const mapLayouts: Readonly<Record<string, TileLayout>> = {
    ...TileLayouts1846,
    D6: ChicagoLayout,
    C21: { hideRevenue: true },
    F22: { hideRevenue: true }
}
const mapBounds = createMapDrawing(EighteenFortySixMap, undefined, { layouts: mapLayouts }).bounds
export const BoardAreas = {
    market: { x: mapBounds.x, y: -460, width: mapBounds.width, height: 110 },
    depot: { x: -55.3, y: -340, width: 500, height: 270 }
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
    revenueStageColors: { I: '#efd34b', II: '#5aa776', III: '#b8824c', IV: '#a7a7a7' }
}

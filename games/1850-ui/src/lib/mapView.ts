import type { Point } from '@tabletop/common'
import { Companies1850, EdgeTokenPrice, Map1850, TileSet1850 } from '@tabletop/1850'
import {
    StandardTileLayouts,
    SpecialStationOutline,
    companyInitialsMark,
    stationLogo,
    towardTileEdge,
    type MapViewDefinition,
    type TileLayout
} from '@tabletop/18xx-ui'
import CBQLogo from './images/logos/CBQ.svg'
import GNLogo from './images/logos/GN.svg'
import MILWLogo from './images/logos/MILW.svg'
import MKTLogo from './images/logos/MKT.svg'
import MPLogo from './images/logos/MP.svg'
import NPLogo from './images/logos/NP.svg'
import RILogo from './images/logos/RI.svg'
import SOOLogo from './images/logos/SOO.svg'
import UPLogo from './images/logos/UP.svg'
import { edgeAreaKind, edgeTokenKind, mesabiKind } from './mapState.js'
import { RiverTerrainPositions, riverLines } from './river.js'
import { TrainColors1850 } from './trainPresentation.js'

// Chicago's two cities sit apart toward their own track until they join in brown (§6.1.3). Green's
// two-space city runs along the hex edge it faces, as printed, with a value in each of two opposite
// corners and the C by the single city. These turn with the tile, so both its legal turns stay clear.
export const TileLayouts1850: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    '1850:128': {
        nodePositions: { 'city-0': towardTileEdge(0, 22), 'city-1': towardTileEdge(2, 22) }
    },
    '1850:129': {
        nodePositions: { 'city-0': towardTileEdge(5.5, 21), 'city-1': towardTileEdge(2, 19) },
        slotRowTurns: { 'city-1': -60 },
        revenuePositions: { 'city-0': { x: -17.5, y: 30.3 }, 'city-1': { x: 16.5, y: -28.6 } },
        labelPosition: { x: 32.5, y: -4.3 }
    }
}
// A layout's label position turns with a pointy hex: this C is drawn in the printed hex's clear
// upper right, the cost in its lower left.
const ChicagoPrinted: TileLayout = {
    nodePositions: { 'city-0': towardTileEdge(5, 22), 'city-1': towardTileEdge(1, 22) },
    labelPosition: { x: 14.8, y: -22.4 }
}

const Stations: MapViewDefinition['stations'] = {
    CBQ: { label: 'CB&Q', color: '#8c8c7e', imageUrl: CBQLogo },
    MILW: { label: 'MILW', color: '#c45114', imageUrl: MILWLogo },
    RI: { label: 'CRI&P', color: '#881319', imageUrl: RILogo },
    GN: { label: 'GN', color: '#6fb3c4', imageUrl: GNLogo },
    MKT: { label: 'MKT', color: '#006521', imageUrl: MKTLogo },
    MP: { label: 'MP', color: '#181d62', imageUrl: MPLogo },
    NP: { label: 'NP', color: '#1c1a17', imageUrl: NPLogo },
    SOO: { label: 'SOO', color: '#c40017', imageUrl: SOOLogo },
    UP: { label: 'UP', color: '#b6ad14', imageUrl: UPLogo }
}

// A printed mark or token turns with the hex: these are given as drawn on the board.
const EdgePlaces: Readonly<Record<string, Point>> = {
    GN: { x: -28, y: -1 },
    MILW: { x: 15.3, y: -18 },
    NP: { x: 15.3, y: -47 },
    MKT: { x: -18, y: -18 },
    SOO: { x: 4, y: 34 },
    UP: { x: -12, y: 31 }
}
const edgePlace = (companyId: string) => {
    const at = EdgePlaces[companyId]
    return at ? { at } : ('corner' as const)
}

const EdgeCompanies = Companies1850.filter((company) => company.edgeArea)

// The Range's four tokens stand either side of its track, clear of its legs and values.
const MesabiPlaces: readonly Point[] = [
    { x: -32, y: -9 },
    { x: 32, y: -9 },
    { x: -26, y: 15 },
    { x: 26, y: 15 }
]

export const MapView1850: MapViewDefinition = {
    map: Map1850,
    tileSet: TileSet1850,
    boardAreas: {
        market: { x: 930, y: -40, width: 1314, height: 760 },
        depot: { x: 1840, y: 400, width: 381, height: 187 }
    },
    offboardNames: { fontSize: 11, color: '#4a0b0b' },
    // Every red area's name stays inside its hex, clear of its connections, values and tokens. The
    // Northwest spans two hexes and is named once.
    namePositions: {
        A2: { x: 0, y: -24 },
        C20: { x: -2, y: -30 },
        F1: { x: -10, y: -24 },
        K20: { x: 8, y: -27 },
        M2: { x: -2, y: 13 },
        M20: { x: 8, y: -27 }
    },
    nameLines: { B1: [], C20: ['Sault', 'Ste. Marie'] },
    // Minneapolis's full name would not fit round its city.
    cityNames: { D9: { city: 'Mpls & St. Paul' } },
    // Cedar Rapids is too long to clear its through track, and turning only pushes one end further
    // onto it. St. Louis reads along the city's foot, on the side the river leaves free.
    nameTurns: { H11: 0, L13: 40 },
    namesBelow: ['L13'],
    // The Northwest is one area across two hexes, with one set of values.
    joinedEdges: { A2: [0], B1: [3] },
    stations: Stations,
    layouts: {
        ...TileLayouts1850,
        I18: ChicagoPrinted,
        // The city stands in the Mississippi's bend, west of it as printed.
        L13: { nodePositions: { city: { x: -10.1, y: 10.5 } } },
        // Clear of each area's name and tokens; a layout position turns with a pointy hex.
        A2: { revenuePositions: { offboard: { x: -0.2, y: -18.4 } } },
        B1: { hideRevenue: true },
        C20: { revenuePositions: { town: { x: 25.5, y: -7.8 } } },
        M2: { revenuePositions: { offboard: { x: 14, y: 24.2 } } }
    },
    revenueStageColors: {
        yellow: [TrainColors1850['2'], TrainColors1850['3']],
        brown: TrainColors1850['5'],
        gray: TrainColors1850['8']
    },
    printedLines: riverLines(),
    terrainPositions: RiverTerrainPositions,
    locationMarkerNames: {
        ...Object.fromEntries(
            EdgeCompanies.flatMap((company) => [
                [
                    edgeAreaKind(company.id),
                    `${Stations[company.id].label}: a $${EdgeTokenPrice} edge token here doubles this area for it`
                ],
                [edgeTokenKind(company.id), `${Stations[company.id].label} edge token`]
            ])
        ),
        ...Object.fromEntries(
            Companies1850.flatMap((company) =>
                MesabiPlaces.map((_, index) => [
                    mesabiKind(index, company.id),
                    `${Stations[company.id].label} Mesabi token`
                ])
            )
        ),
        'blocks-MRBC': 'No track while the Mississippi River Bridge Company is player-owned',
        'blocks-MMR': 'No track while the Mississippi and Missouri Railroad is player-owned'
    },
    markerArt: {
        'blocks-MRBC': { localLine: true, at: { x: 10, y: -30 } },
        'blocks-MMR': { localLine: true, above: true },
        ...Object.fromEntries(
            EdgeCompanies.flatMap((company) => [
                [
                    edgeAreaKind(company.id),
                    {
                        token: {
                            imageUrl: companyInitialsMark(Stations[company.id].label),
                            place: edgePlace(company.id)
                        }
                    }
                ],
                [
                    edgeTokenKind(company.id),
                    {
                        token: {
                            imageUrl: stationLogo(Stations, company.id),
                            place: edgePlace(company.id),
                            outline: SpecialStationOutline
                        }
                    }
                ]
            ])
        ),
        ...Object.fromEntries(
            Companies1850.flatMap((company) =>
                MesabiPlaces.map((at, index) => [
                    mesabiKind(index, company.id),
                    { token: { imageUrl: stationLogo(Stations, company.id), place: { at } } }
                ])
            )
        )
    }
}

import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createCityTileFace as cityFace,
    createLetterNumberLocationFactory,
    createOffboardTileFace,
    createSeparateCitiesTileFace as citiesFace,
    createStagedTileRevenue,
    createTownTileFace as townFace,
    createTrackTileFace as trackFace,
    type MapLocation,
    type RevenueCenter,
    type TileEdge,
    type TileFace,
    type TileRevenue
} from '@tabletop/18xx'
import { CnId } from './companies.js'
import { MontrealLabel, OttawaLabel, TorontoLabel, YLabel } from './tiles.js'

export const TorontoLocationId = 'F16'
export const MontrealLocationId = 'L12'
export const QuebecLocationId = 'O7'
export const OttawaLocationId = 'J12'
export const TimminsLocationId = 'D2'
export const BuffaloLocationId = 'F18'
export const DetroitLocationIds: readonly string[] = ['A17', 'A19']
export const LakePortLocationIds: readonly string[] = ['E19', 'H16']

/** Toronto's two printed stations: the CN's, placed at setup, and an open one (§2.H, §7.2.1). */
export const TorontoNodeIds = { national: 'city-0', open: 'city-1' } as const
/** Montreal's three printed stations, the third without track until the green tile. */
export const MontrealNodeIds: readonly string[] = ['city-0', 'city-1', 'city-2']
/** The CN's station from setup (§2.H). */
export const CnHome: RevenueCenter = {
    locationId: TorontoLocationId,
    nodeId: TorontoNodeIds.national
}

/** The city spots printed green, open to a minor's station only from phase 3 (§7.2.1). */
export const GreenCitySpots1867: readonly RevenueCenter[] = [
    { locationId: MontrealLocationId, nodeId: MontrealNodeIds[2] },
    { locationId: TimminsLocationId, nodeId: 'city' }
]
export const GreenCitySpotsOpenPhaseId = '3'

/** The hexes marked with a lock, closed to track until phase 3 (§8.6, §11). */
export const LockedLocationIds1867: readonly string[] = ['M13']
export const LockedHexesOpenPhaseId = '3'

/**
 * The yellow triangles: the edge a yellow tile laid in each of these hexes must connect to
 * (§8.6.2).
 */
export const YellowTileStubs1867: Readonly<Record<string, TileEdge>> = {
    G15: 1,
    K13: 4,
    L10: 0
}

/** Timmins counts double on a route that also counts Toronto, Montreal or Quebec (§8.8.2). */
export const TimminsDoublingLocationIds: readonly string[] = [
    TorontoLocationId,
    MontrealLocationId,
    QuebecLocationId
]

/** Off-board values: yellow in phase 2, green in 3–4, brown in 5–6, grey in 7–8 (§11). */
export const RevenueStages1867 = ['yellow', 'green', 'brown', 'gray'] as const

const Names: Readonly<Record<string, string>> = {
    A7: 'Sault Ste. Marie',
    A17: 'Detroit',
    A19: 'Detroit',
    B18: 'Sarnia',
    C15: 'Goderich',
    C17: 'London',
    D2: 'Timmins',
    D8: 'Sudbury',
    D16: 'Berlin',
    E13: 'Barrie',
    E15: 'Guelph',
    E17: 'Hamilton',
    F8: 'North Bay',
    F16: 'Toronto',
    F18: 'Buffalo',
    G15: 'Peterborough',
    H10: 'Pembroke',
    H14: 'Belleville',
    I15: 'Kingston',
    J12: 'Ottawa',
    K13: 'Cornwall',
    L10: 'St. Jerome',
    L12: 'Montreal',
    M9: 'Trois-Rivières',
    M13: 'Granby',
    M15: 'New England',
    N12: 'Sherbrooke',
    O7: 'Quebec',
    O13: 'Maine',
    P8: 'Maritime Provinces'
}

const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = Object.fromEntries(
    LockedLocationIds1867.map((locationId) => [
        locationId,
        [{ id: 'locked', label: 'Locked', description: 'No track here until phase 3.' }]
    ])
)

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 1,
    fixedColors: ['gray', 'red', 'blue'],
    names: Names,
    homes: { [TorontoLocationId]: { companyId: CnId, nodeId: TorontoNodeIds.national } },
    markers: Markers
})

type Details = NonNullable<Parameters<typeof locations>[2]>

// Water costs $20 to build in a hex, $80 to cross a river border (§8.6.2).
const water: Details = { terrain: { cost: 20, kinds: ['water'] } }
const impassable = (...edges: TileEdge[]): Details => ({
    borders: edges.map((edge) => ({ edge, kind: 'impassable' as const }))
})
const river = (...edges: TileEdge[]): Details => ({
    borders: edges.map((edge) => ({ edge, kind: 'water' as const, cost: 80 }))
})

const phased = (yellow: number, green: number, brown: number, gray: number): TileRevenue =>
    createStagedTileRevenue([
        ['yellow', yellow],
        ['green', green],
        ['brown', brown],
        ['gray', gray]
    ])
const offboard = (edges: readonly TileEdge[], revenue: TileRevenue) =>
    createOffboardTileFace(edges, revenue)
const lakePort = (edges: readonly TileEdge[]): TileFace => ({
    ...createOffboardTileFace(edges, { kind: 'fixed', amount: 10 }),
    color: 'blue'
})

const blank = trackFace('white', [])
const town = townFace('white', [[]], 0)
const city = cityFace('white', [], 0, 1)
const yCity = cityFace('white', [], 0, 1, [YLabel])

export const Map1867 = new RailwayMap({
    id: '1867',
    name: '1867',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations(
            'B6 B8 C5 C7 C19 D4 D6 D14 E3 E5 E7 E9 F2 F4 F6 F10 F12 F14 G3 G5 G7 G9 G11 G13 H4 H6 H8 H12 I5 I7 I9 I11 I13 J6 J8 J10 J14 K5 K7 K9 L6 L8 M5 M7 N6 O11',
            blank
        ),
        // The thick black borders of the Great Lakes shore (§8.6.1).
        ...locations('D18', blank, impassable(5)),
        ...locations('C9', blank, impassable(0, 5)),
        ...locations('D10', blank, impassable(0, 1, 2, 5)),
        ...locations('E11', blank, impassable(1, 2)),
        ...locations('C11', blank, impassable(0, 3, 4)),
        ...locations('D12', blank, impassable(3, 4)),
        ...locations('C13', blank, impassable(3)),
        ...locations('K11', blank, water),
        ...locations('N8', blank, river(0, 5)),
        ...locations('N10 M11', blank, river(2, 3)),
        ...locations('O9', blank, river(2)),
        ...locations('D8 F8 E13 E15 C17 I15 N12 G15', city),
        ...locations('M9', city, river(0, 5)),
        ...locations('E17 D16 O7', yCity),
        // Ottawa takes the Y tiles to brown and its own grey O tile (§8.6).
        ...locations(OttawaLocationId, yCity, {
            ...water,
            upgradeLabels: [{ color: 'gray', label: OttawaLabel }]
        }),
        ...locations('C15 B18 H10 M13 K13', town),
        ...locations('L10', town, river(5)),
        ...locations('H14', town, impassable(0)),
        // The grey hexes: track and stops printed, never built on (§8.6).
        ...locations(TimminsLocationId, cityFace('gray', [0, 1, 4, 5], 40, 1)),
        ...locations('C3', trackFace('gray', [[0, 4]])),
        ...locations('E1', trackFace('gray', [[1, 5]])),
        ...locations('B16', trackFace('gray', [[0, 5]])),
        ...locations('L14', trackFace('gray', [[2, 3]])),
        // Montreal and Toronto, printed yellow and upgraded as laid tiles (§8.6).
        ...locations(
            MontrealLocationId,
            citiesFace(
                'yellow',
                [
                    { edges: [1], revenue: 40, stationSlots: 1 },
                    { edges: [3], revenue: 40, stationSlots: 1 },
                    { edges: [], revenue: 40, stationSlots: 1 }
                ],
                [MontrealLabel]
            ),
            water
        ),
        ...locations(
            TorontoLocationId,
            citiesFace(
                'yellow',
                [
                    { edges: [1], revenue: 30, stationSlots: 1 },
                    { edges: [4], revenue: 30, stationSlots: 1 }
                ],
                [TorontoLabel]
            )
        ),
        // The red off-board locations; Detroit is one location printed over two hexes.
        ...locations('A7', offboard([4, 5], phased(20, 30, 40, 40))),
        ...locations(BuffaloLocationId, offboard([2], phased(30, 40, 50, 60))),
        ...locations('M15', offboard([3], phased(30, 40, 50, 60))),
        ...locations('O13', offboard([2, 3], phased(20, 30, 40, 40))),
        ...locations('P8', offboard([1, 2], phased(30, 30, 40, 40))),
        ...locations('A17', offboard([5], phased(30, 40, 50, 70)), { stopGroup: 'Detroit' }),
        ...locations('A19', offboard([4], phased(30, 40, 50, 70)), { stopGroup: 'Detroit' }),
        // The lake ports, worth $10 in every phase.
        ...locations('E19', lakePort([3]), impassable(2)),
        ...locations('H16', lakePort([2, 4]), impassable(3))
    ]
})

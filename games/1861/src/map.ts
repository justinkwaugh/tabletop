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
    type CityReservation,
    type MapLocation,
    type TileEdge,
    type TileFace,
    type TileRevenue
} from '@tabletop/18xx'
import { Minors1861, RsrId } from './companies.js'

export const MoscowLocationId = 'H8'
export const EkaterinburgLocationId = 'Q3'
export const StPetersburgLocationId = 'E1'
export const KievLocationId = 'D14'
export const KharkovLocationId = 'G15'
export const OdessaLocationId = 'D20'
export const PolandLocationIds: readonly string[] = ['A9', 'A11', 'A13', 'A15']
export const RomaniaLocationIds: readonly string[] = ['B18', 'B20']
export const CaucasusLocationIds: readonly string[] = ['J20', 'I21', 'K21']
export const CentralAsiaLocationIds: readonly string[] = ['Q11', 'Q13']

/** St. Petersburg's two stations on its printed green tile: the SP-W's and the RSR's (§7.4). */
export const StPetersburgNodeIds = { west: 'city-0', state: 'city-1' } as const
/** Moscow's and Kiev's three printed stations, each on its own track. */
export const MoscowNodeIds: readonly string[] = ['city-0', 'city-1', 'city-2']
export const KievNodeIds: readonly string[] = ['city-0', 'city-1', 'city-2']

/** The hexes of the private companies, closed to track until phase 3 (§8, §10.4). */
export const PrivateLocationIds1861: Readonly<Record<string, readonly string[]>> = {
    TSR: ['E3'],
    MYR: ['H6', 'I5'],
    MRR: ['I9', 'J10']
}
export const PrivateBlockedLocationIds: readonly string[] =
    Object.values(PrivateLocationIds1861).flat()
/** The phase from which track may be built on the private companies' hexes (§8). */
export const PrivateHexesOpenPhaseId = '3'

/** The off-board values: lowest in phase 2, second in 3–4, third in 5, highest in 6–8 (§10.6). */
export const RevenueStages1861 = ['yellow', 'green', 'brown', 'gray'] as const

const Names: Readonly<Record<string, string>> = {
    A9: 'Poland',
    A11: 'Poland',
    A13: 'Poland',
    A15: 'Poland',
    B4: 'Riga',
    B8: 'Vilna',
    B18: 'Romania',
    B20: 'Romania',
    C5: 'Dünaberg',
    C9: 'Minsk',
    D14: 'Kiev',
    D20: 'Odessa',
    E1: 'St. Petersburg',
    E9: 'Smolensk',
    E11: 'Gomel',
    E13: 'Chernigov',
    F18: 'Ekaterinoslav',
    G5: 'Tver',
    G13: 'Kursk',
    G15: 'Kharkov',
    G19: 'Alexandrovsk',
    H8: 'Moscow',
    H10: 'Tula',
    H18: 'Yuzovka',
    I5: 'Yaroslavl',
    I13: 'Voronezh',
    I17: 'Lugansk',
    I19: 'Rostov',
    I21: 'Caucasus',
    J20: 'Caucasus',
    K21: 'Caucasus',
    K7: 'Nizhnii Novgorod',
    K11: 'Penza',
    K17: 'Tsaritsyn',
    L12: 'Saratov',
    M7: 'Kazan',
    M9: 'Simbirsk',
    M19: 'Astrakhan',
    N10: 'Samara',
    P2: 'Perm',
    P8: 'Ufa',
    Q3: 'Ekaterinburg',
    Q11: 'Central Asia',
    Q13: 'Central Asia'
}

// Each minor company's home station space, reserved until phase 5 (§10.5), and the RSR's space in
// St. Petersburg (§7.4).
const homes: readonly (readonly [string, string, string])[] = [
    ...Minors1861.map(({ id, home }) => [home.locationId, id, home.nodeId] as const),
    [StPetersburgLocationId, RsrId, StPetersburgNodeIds.state]
]
const Homes: Readonly<Record<string, readonly CityReservation[]>> = Object.fromEntries(
    [...new Set(homes.map(([locationId]) => locationId))].map((locationId) => [
        locationId,
        homes
            .filter(([homeLocationId]) => homeLocationId === locationId)
            .map(([, companyId, nodeId]) => ({ companyId, nodeId }))
    ])
)

const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = Object.fromEntries(
    Object.entries(PrivateLocationIds1861).flatMap(([privateCompanyId, locationIds]) =>
        locationIds.map((locationId) => [
            locationId,
            [
                {
                    id: `private-${privateCompanyId}`,
                    label: privateCompanyId,
                    privateCompanyId,
                    description: 'No track here until phase 3.'
                }
            ]
        ])
    )
)

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 1,
    fixedColors: ['gray', 'red'],
    names: Names,
    homes: Homes,
    markers: Markers
})

type Details = NonNullable<Parameters<typeof locations>[2]>

// Difficult terrain is water at R20, R40 or R80 (§10.4).
const water = (cost: 20 | 40 | 80): Details => ({ terrain: { cost, kinds: ['water'] } })

const phased = (yellow: number, green: number, brown: number, gray: number): TileRevenue =>
    createStagedTileRevenue([
        ['yellow', yellow],
        ['green', green],
        ['brown', brown],
        ['gray', gray]
    ])
const poland = phased(30, 40, 50, 70)
const romania = phased(10, 20, 30, 30)
const caucasus = phased(10, 20, 40, 60)
const centralAsia = phased(10, 20, 30, 40)
const offboard = (edges: readonly TileEdge[], revenue: TileRevenue) =>
    createOffboardTileFace(edges, revenue)

const blank = trackFace('white', [])
const town = townFace('white', [[]], 0)
const city = cityFace('white', [], 0, 1)
const yCity = cityFace('white', [], 0, 1, ['Y'])

// Dünaberg: a grey town on one track and a separate track past it.
const dunaberg: TileFace = {
    ...townFace('gray', [[2, 5]], 10),
    paths: [
        ...townFace('gray', [[2, 5]], 10).paths,
        ...trackFace('gray', [[0, 4]]).paths.map((path) => ({ ...path, id: 'track-0-4' }))
    ]
}

export const Map1861 = new RailwayMap({
    id: '1861',
    name: '1861',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations(
            'B6 B10 B12 B14 B16 C3 C13 C15 D6 D8 D16 D18 E3 E5 E7 E17 F6 F8 F10 F12 F14 F20 G3 G9 G11 G17 H2 H4 H6 H12 H14 H16 H20 I3 I7 I9 I11 J2 J4 J8 J10 J12 J14 K3 K5 K9 K13 K15 K19 L2 L4 L8 L10 L14 L18 L20 M3 M5 N2 N4 N8 N12 N20 O1 O3 O7 O9 O11 P6 P10 P12',
            blank
        ),
        ...locations('C11 D12 M11', blank, water(80)),
        ...locations('E15 E19 F16 I15 J16 J18', blank, water(40)),
        ...locations('C17 C19 D10 J6 L6 N6 O5 P4', blank, water(20)),
        ...locations('B8 C9 E11 E13 G19 G13 H10 I17 K11', town),
        ...locations('I5', town, water(20)),
        ...locations('M9', town, water(80)),
        ...locations('E9 H18 I13 I19 K17 L12 P8', city),
        ...locations('P2', city, water(20)),
        ...locations('F18 M7', city, water(40)),
        ...locations('B4 D20 M19 N10', yCity),
        // Kharkov takes the Y tiles to brown and its own grey Kh tile (§10.4).
        ...locations(KharkovLocationId, yCity, {
            upgradeLabels: [{ color: 'gray', label: 'Kh' }]
        }),
        // The grey areas (§5): track and stops printed, never built on.
        ...locations('A5', trackFace('gray', [[4, 5]])),
        ...locations('C5', dunaberg),
        ...locations('C21', trackFace('gray', [[4, 3]])),
        ...locations('M21', trackFace('gray', [[3, 2]])),
        ...locations('P0', trackFace('gray', [[0, 1]])),
        ...locations('Q7', trackFace('gray', [[1, 2]])),
        ...locations(
            'Q5',
            trackFace('gray', [
                [3, 2],
                [3, 1]
            ])
        ),
        ...locations(EkaterinburgLocationId, cityFace('gray', [2, 1, 0], 40, 1)),
        // Hexes printed with yellow or green track, upgraded as laid tiles (§10.4).
        ...locations('C7 D4', trackFace('yellow', [[3, 1]])),
        ...locations('F4 G7', trackFace('yellow', [[3, 5]])),
        ...locations('D2', trackFace('yellow', [[0, 4]])),
        ...locations('F2', trackFace('yellow', [[0, 2]])),
        ...locations('G5', townFace('yellow', [[2, 0]], 10)),
        ...locations(
            MoscowLocationId,
            citiesFace(
                'yellow',
                [
                    { edges: [0], revenue: 40, stationSlots: 1 },
                    { edges: [2], revenue: 40, stationSlots: 1 },
                    { edges: [4], revenue: 40, stationSlots: 1 }
                ],
                ['M']
            )
        ),
        ...locations(
            KievLocationId,
            citiesFace(
                'yellow',
                [
                    { edges: [0], revenue: 30, stationSlots: 1 },
                    { edges: [2], revenue: 30, stationSlots: 1 },
                    { edges: [4], revenue: 30, stationSlots: 1 }
                ],
                ['K']
            )
        ),
        ...locations('K7', cityFace('yellow', [1, 5], 30, 1, ['Y']), water(20)),
        ...locations(
            StPetersburgLocationId,
            citiesFace(
                'green',
                [
                    { edges: [1], revenue: 40, stationSlots: 1 },
                    { edges: [5], revenue: 40, stationSlots: 1 }
                ],
                ['S']
            )
        ),
        // The red off-board areas (§5, §10.6), each printed as one; a route counts each area once.
        ...locations(PolandLocationIds.join(' '), offboard([5, 4], poland), {
            stopGroup: 'Poland'
        }),
        ...locations('B18', offboard([3, 4, 5], romania), { stopGroup: 'Romania' }),
        ...locations('B20', offboard([4], romania), { stopGroup: 'Romania' }),
        ...locations('J20', offboard([2, 3, 4], caucasus), { stopGroup: 'Caucasus' }),
        ...locations('I21', offboard([3], caucasus), { stopGroup: 'Caucasus' }),
        ...locations('K21', offboard([3, 4], caucasus), { stopGroup: 'Caucasus' }),
        ...locations('Q11', offboard([1, 2], centralAsia), { stopGroup: 'CentralAsia' }),
        ...locations('Q13', offboard([2], centralAsia), { stopGroup: 'CentralAsia' })
    ]
})

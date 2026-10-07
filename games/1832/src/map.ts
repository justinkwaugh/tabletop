import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createStagedTileRevenue as revenue,
    createTrackTileFace as track,
    createTownTileFace as town,
    createCityTileFace as city,
    createSeparateCitiesTileFace as cities,
    createOffboardTileFace as offboard,
    type CityReservation,
    type MapLocation
} from '@tabletop/18xx'

const Names: Readonly<Record<string, string>> = {
    N19: 'Louisville',
    N33: 'Richmond',
    O14: 'Kansas City',
    O26: 'West Virginia Coal Fields',
    O30: 'Lynchburg',
    O36: 'Norfolk',
    P15: 'Jackson',
    P19: 'Nashville',
    P23: 'Knoxville',
    P29: 'Winston-Salem & Greensboro',
    Q16: 'Corinth',
    Q20: 'Chattanooga',
    Q28: 'Charlotte',
    Q32: 'Raleigh',
    R29: 'Columbia',
    R33: 'Wilmington',
    S18: 'Birmingham',
    S22: 'Atlanta',
    S26: 'Augusta',
    T15: 'Meridian',
    T21: 'Columbus',
    T23: 'Macon',
    T29: 'Charleston',
    U18: 'Montgomery',
    U20: 'Eufaula',
    U28: 'Savannah',
    V15: 'Mobile',
    W14: 'New Orleans',
    W16: 'Pensacola',
    W22: 'Tallahassee',
    W24: 'Valdosta',
    W26: 'Jacksonville',
    Y26: 'Orlando',
    Z25: 'Tampa',
    Z27: 'Lakeland & Winter Haven',
    AA28: 'Miami'
}

const Homes: Readonly<Record<string, string | CityReservation>> = {
    T29: 'ACL',
    Q32: 'SAL',
    O36: 'NW',
    U28: 'CG',
    P19: 'LN',
    W14: 'GMO',
    P23: 'SOU',
    W26: 'FEC'
}

// Anchors mark the coastal locations eligible for the Atlantic Shipping port (§16.2 P3).
const PortLocationIds = 'O36 R33 T29 U28 V15 W14 W16 W22 W26 Z25 AA28'.split(' ')
const Port = {
    id: 'port',
    label: '⚓',
    description: 'Coastal: the Atlantic Shipping port may be placed here.'
}
// Medium cities take a yellow town tile, then a green town or a yellow city (§6.4.2).
const MediumCityLocationIds = 'Q20 S26 T21 T23 U18 Y26'.split(' ')
const MediumCity = {
    id: 'medium-city',
    label: 'M',
    description: 'Medium city: its yellow town may become a green town or a yellow city.'
}
const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = Object.fromEntries(
    [...new Set([...PortLocationIds, ...MediumCityLocationIds])].map((id) => [
        id,
        [
            ...(PortLocationIds.includes(id) ? [Port] : []),
            ...(MediumCityLocationIds.includes(id) ? [MediumCity] : [])
        ]
    ])
)

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 0,
    fixedColors: ['gray', 'red'],
    names: Names,
    homes: Homes,
    markers: Markers
})

const terrain = (cost: number, kind: 'mountain' | 'water') => ({
    terrain: { cost, kinds: [kind] }
})
const blank = track('white', [])
const largeCity = city('white', [], 0, 1)
const singleTown = town('white', [[]], 0)
// Offboard and gray values change with phase: the first value until phase 5, the second
// until phase 8, then the last (§4.2, Table 1).
const staged = (first: number, second: number, last?: number) =>
    revenue([
        ['yellow', first],
        ['brown', second],
        ...(last === undefined ? [] : [['gray', last] as const])
    ])

export const EighteenThirtyTwoMap = new RailwayMap({
    id: '1832',
    name: '1832',
    orientation: HexOrientation.Pointy,
    locations: [
        ...locations('N19 N33', offboard([5, 0], staged(30, 50))),
        ...locations('O14', offboard([5, 4], staged(30, 50, 60))),
        ...locations('AA28', offboard([1, 2, 3], staged(20, 30, 50))),
        ...locations('O26', town('gray', [[0, 1, 4, 5]], staged(40, 60))),
        ...locations('O36', city('gray', [1, 0], staged(20, 40, 50), 1)),
        ...locations('W14', city('gray', [2, 3, 4], staged(20, 30, 50), 1)),
        ...locations('V13', track('gray', [[4, 5]])),
        ...locations('Z29', track('gray', [[2, 0]])),
        // Georgia Railroad and the Atlanta & West Point each reserve one of Atlanta's cities.
        ...locations(
            'S22',
            cities(
                'yellow',
                [
                    { edges: [4], revenue: 20, stationSlots: 1 },
                    { edges: [0], revenue: 20, stationSlots: 1 },
                    { edges: [2], revenue: 20, stationSlots: 1 }
                ],
                ['A']
            )
        ).map((location) => ({
            ...location,
            reservations: [
                { companyId: 'GRR', nodeId: 'city-0' },
                { companyId: 'AWP', nodeId: 'city-1' }
            ]
        })),
        ...locations(
            'O18 O20 O32 O34 P17 P31 P33 P35 Q14 Q26 Q30 Q34 R15 R17 R27 R31 S14 S16 S24 S28 S30 T17 T19 T25 U14 U16 U22 U24 U26 V17 V19 V21 V23 V25 W20 X25',
            blank
        ),
        ...locations('Q18 R19 R21 S20', blank, terrain(40, 'mountain')),
        ...locations('O22 O24 P21 Q22 R23', blank, terrain(60, 'mountain')),
        ...locations('O28 P27', blank, terrain(70, 'mountain')),
        ...locations('P25 Q24', blank, terrain(80, 'mountain')),
        ...locations('O16 R25 X27 Y28', blank, terrain(40, 'water')),
        ...locations('T27 V27 AA26', blank, terrain(60, 'water')),
        ...locations('R35 S32 T31 W18 X21 X23 Y24 AA24', blank, terrain(80, 'water')),
        ...locations('P19 Q28 Q32 S18 V15 W22', largeCity),
        ...locations('P23', largeCity, terrain(60, 'water')),
        ...locations('Z25', largeCity, terrain(40, 'water')),
        ...locations('T29', largeCity, {
            ...terrain(60, 'water'),
            upgradeLabels: [{ color: 'brown', label: 'Y' }]
        }),
        ...locations('W26', largeCity, { upgradeLabels: [{ color: 'brown', label: 'Y' }] }),
        ...locations('U28', largeCity, {
            ...terrain(60, 'water'),
            upgradeLabels: [{ color: 'brown', label: 'S' }]
        }),
        ...locations('O30 R29 R33 T15 U20 W24 T21 T23 U18 Y26', singleTown),
        ...locations('P15 Q16 Q20 S26', singleTown, terrain(40, 'water')),
        ...locations('W16', singleTown, terrain(80, 'water')),
        ...locations('P29 Z27', town('white', [[], []], 0))
    ]
})

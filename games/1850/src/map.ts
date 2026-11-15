import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createCityTileFace as city,
    createLetterNumberLocationFactory,
    createOffboardTileFace as offboard,
    createSeparateCitiesTileFace as cities,
    createStagedTileRevenue as revenue,
    createTownTileFace as town,
    createTrackTileFace as track,
    type MapLocation
} from '@tabletop/18xx'

const Names: Readonly<Record<string, string>> = {
    A2: 'Northwest',
    B1: 'Northwest',
    A10: 'Mesabi Range',
    B5: 'Fargo',
    B11: 'Duluth',
    C20: 'Sault Ste. Marie',
    D9: 'Minneapolis & St. Paul',
    E4: 'Sioux Falls',
    E18: 'Green Bay',
    F1: 'West',
    F13: 'La Crosse',
    G4: 'Sioux City',
    G16: 'Madison',
    G18: 'Milwaukee',
    H9: 'Des Moines',
    H11: 'Cedar Rapids',
    I4: 'Omaha',
    I12: 'Rock Island',
    I18: 'Chicago',
    J11: 'Burlington & Quincy',
    K4: 'Topeka',
    K6: 'Kansas City',
    K14: 'Springfield, IL',
    K20: 'East',
    L13: 'St. Louis',
    M2: 'Southwest',
    M8: 'Springfield, MO',
    M20: 'South'
}

const Homes: Readonly<Record<string, string>> = {
    G18: 'MILW',
    H11: 'RI',
    D9: 'GN',
    K6: 'MKT',
    L13: 'MP',
    B11: 'NP',
    F13: 'SOO',
    I4: 'UP'
}

export const NorthwestLocationIds: readonly string[] = ['A2', 'B1']
export const MesabiLocationId = 'A10'
export const ChicagoLocationId = 'I18'
/** The western of Chicago's two cities, where the Burlington always starts (§6.1.3). */
export const WestChicagoNodeId = 'city-1'

/**
 * The hexes west of the Mississippi (glossary): none with the river in it, and the hex west of the
 * Mesabi Range counts as river.
 */
export const WestOfMississippi: readonly string[] =
    'A4 A6 B3 B5 C2 C4 C6 D3 D5 D7 E2 E4 E6 E8 F3 F5 F7 F9 F11 G2 G4 G6 G8 G10 H3 H5 H7 H9 I2 I4 I6 I8 I10 J3 J5 J7 J9 K2 K4 K6 K8 K10 L3 L5 L7 L9 L11 M4 M6 M8 M10'.split(
        ' '
    )

function blocker(id: string, name: string): NonNullable<MapLocation['markers']>[number] {
    return {
        id: `blocks-${id}`,
        label: id,
        privateCompanyId: id,
        description: `No track while the ${name} is player-owned.`
    }
}

const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = {
    I12: [blocker('MMR', 'Mississippi and Missouri Railroad')],
    L13: [blocker('MRBC', 'Mississippi River Bridge Company')]
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 0,
    markers: Markers,
    fixedColors: ['gray', 'red'],
    names: Names,
    homes: Homes
})

const terrain = (cost: number, kind: 'mountain' | 'water' = 'water') => ({
    terrain: { cost, kinds: [kind] }
})
const blank = track('white', [])
const largeCity = city('white', [], 0, 1)
const singleTown = town('white', [[]], 0)
const doubleTown = town('white', [[], []], 0)
const staged = (first: number, second: number, last?: number) =>
    revenue([
        ['yellow', first],
        ['brown', second],
        ...(last === undefined ? [] : [['gray', last] as const])
    ])
// Kansas City, Minneapolis and St. Louis take only #135 in brown, and #138 after it (§6.4.3).
const P = { upgradeLabels: [{ color: 'brown', label: 'P' }] }
const northwest = { stopGroup: 'Northwest' }

export const Map1850 = new RailwayMap({
    id: '1850',
    name: '1850',
    orientation: HexOrientation.Pointy,
    locations: [
        ...locations('A2', offboard([4, 5], staged(30, 40)), northwest),
        ...locations('B1', offboard([4, 5], staged(30, 40)), northwest),
        ...locations('F1', offboard([3, 4, 5], staged(30, 40))),
        ...locations('M2', offboard([3, 4], staged(30, 40))),
        ...locations('K20', offboard([0, 1, 2], staged(30, 40, 50))),
        ...locations('M20', offboard([1, 2], staged(20, 30, 40))),
        ...locations('C20', town('red', [[0, 1]], staged(20, 40, 50))),
        ...locations('A10', town('gray', [[0, 1, 4, 5]], staged(30, 40, 60))),
        ...locations('I20', track('gray', [[0, 1]])),
        ...locations(
            'A4 A6 A8 A14 B3 B9 C2 C4 C6 C10 C12 C14 C18 D3 D5 D11 D15 D17 E2 E6 E8 E14 E16 F5 F7 F9 F11 F17 G2 G6 G8 G14 H3 H7 H15 I6 I10 I14 J3 J7 J9 J13 J15 J17 J19 K2 K10 K16 K18 L3 L5 L7 L15 L17 L19 M6 M10 M14 M16',
            blank
        ),
        ...locations('B5 B11 E4 E18 G16 H9 K4 K14 M8', largeCity),
        ...locations('C16 D7 D13 F15 G10 H17 I2 I16 M4 M18', singleTown),
        ...locations('B13 C8 D19 E12 F3 G12 H5 H13 J5 K12 L9 L11', blank, terrain(40)),
        ...locations('I8', doubleTown),
        ...locations('A12', blank, terrain(60, 'mountain')),
        ...locations('B7 I12 K8 M12', singleTown, terrain(40)),
        ...locations('E10 J11', doubleTown, terrain(40)),
        ...locations('F13 G4 I4', largeCity, terrain(40)),
        ...locations('D9 K6 L13', largeCity, { ...terrain(40), ...P }),
        ...locations(
            'I18',
            cities(
                'white',
                [
                    { edges: [], revenue: 0, stationSlots: 1 },
                    { edges: [], revenue: 0, stationSlots: 1 }
                ],
                ['C']
            ),
            terrain(40)
        ).map((location) => ({
            ...location,
            reservations: [{ companyId: 'CBQ', nodeId: WestChicagoNodeId }]
        })),
        ...locations('G18', city('yellow', [1], 20, 1, ['M']), terrain(40)),
        ...locations('H11', city('yellow', [1, 4], 20, 1))
    ]
})

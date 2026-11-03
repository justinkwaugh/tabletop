import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createCityTileFace as city,
    createLetterNumberLocationFactory,
    createOffboardTileFace as offboard,
    createStagedTileRevenue as revenue,
    createTownTileFace as town,
    createTrackTileFace as track,
    type MapLocation,
    type TileEdge
} from '@tabletop/18xx'

const Names: Readonly<Record<string, string>> = {
    A2: 'Denver',
    A22: 'Chicago',
    B9: 'Topeka',
    B11: 'Kansas City',
    B19: 'Springfield, IL',
    C18: 'St. Louis',
    D5: 'Wichita',
    E12: 'Springfield, MO',
    F5: 'Oklahoma City',
    H13: 'Little Rock',
    H17: 'Memphis',
    J3: 'Fort Worth',
    J5: 'Dallas',
    K16: 'Jackson',
    L11: 'Alexandria',
    M2: 'Austin',
    M6: 'Houston',
    M14: 'Baton Rouge',
    M20: 'Mobile',
    M22: 'Southeast',
    N1: 'Southwest',
    N7: 'Galveston',
    N17: 'New Orleans'
}

const Homes: Readonly<Record<string, string>> = {
    B9: 'ATSF',
    J3: 'FW',
    M20: 'GMO',
    K16: 'IC',
    C18: 'MP',
    B11: 'MKT',
    H17: 'SSW',
    E12: 'SLSF',
    J5: 'TP'
}

export const OffboardHomeLocationId = 'N1'

/** The cities the Gulf Shipping Company's port may go on: on the Gulf, or on the river (p. 9). */
export const PortLocationIds: readonly string[] = ['H17', 'M14', 'M20', 'N7', 'N17']
/**
 * The cities the Southern Cattle Company's token may go on: west of the Mississippi, in no hex
 * the river passes through (p. 9).
 */
export const CattleLocationIds: readonly string[] = 'B9 B11 D5 E12 F5 H13 J3 J5 L11 M2 M6 N7'.split(
    ' '
)

const Port = {
    id: 'port',
    label: '⚓',
    description: 'On the Gulf or the river: the Gulf Shipping Company’s port may be placed here.'
}
const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = Object.fromEntries(
    PortLocationIds.map((id) => [id, [Port]])
)

/**
 * What the Mississippi divides in a hex until the bridge company is sold or closed: the hex edges
 * on each side. Track may not join the two. A hex with a city or towns on one bank allows only
 * that bank's edges (p. 9).
 */
export type RiverHex = {
    /** The hex corners the river runs between, the bottom one 0 and going clockwise. */
    course: readonly [number, number]
    banks: readonly [readonly TileEdge[], readonly TileEdge[]]
    stopBank?: 0 | 1
}
// prettier-ignore
export const RiverHexes: Readonly<Record<string, RiverHex>> = {
    A16: { course: [0, 3], banks: [[0, 1, 2], [3, 4, 5]], stopBank: 0 },
    B17: { course: [0, 2], banks: [[0, 1], [2, 3, 4, 5]] },
    C18: { course: [0, 2], banks: [[0, 1], [2, 3, 4, 5]], stopBank: 0 },
    D17: { course: [4, 5], banks: [[4], [0, 1, 2, 3, 5]], stopBank: 1 },
    E18: { course: [3, 5], banks: [[3, 4], [0, 1, 2, 5]] },
    F19: { course: [1, 3], banks: [[1, 2], [0, 3, 4, 5]] },
    G18: { course: [1, 3], banks: [[1, 2], [0, 3, 4, 5]] },
    H17: { course: [1, 3], banks: [[1, 2], [0, 3, 4, 5]], stopBank: 1 },
    I16: { course: [1, 3], banks: [[1, 2], [0, 3, 4, 5]] },
    J15: { course: [0, 3], banks: [[0, 1, 2], [3, 4, 5]] },
    K14: { course: [0, 4], banks: [[0, 1, 2, 3], [4, 5]], stopBank: 1 },
    L13: { course: [0, 4], banks: [[0, 1, 2, 3], [4, 5]] },
    M14: { course: [0, 2], banks: [[0, 1], [2, 3, 4, 5]], stopBank: 1 },
    N15: { course: [2, 5], banks: [[2, 3, 4], [0, 1, 5]] },
    O16: { course: [3, 4], banks: [[3], [0, 1, 2, 4, 5]] },
    O18: { course: [0, 2], banks: [[0, 1], [2, 3, 4, 5]] }
}
export const RiverLocationIds: readonly string[] = Object.keys(RiverHexes)

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 0,
    fixedColors: ['red'],
    names: Names,
    homes: Homes,
    markers: Markers
})

const terrain = (cost: number, kind: 'mountain' | 'water' = 'water') => ({
    terrain: { cost, kinds: [kind] }
})
const blank = track('white', [])
const largeCity = city('white', [], 0, 1)
const singleTown = town('white', [[]], 0)
const doubleTown = town('white', [[], []], 0)
const staged = (top: number, middle: number, bottom: number) =>
    revenue([
        ['yellow', top],
        ['brown', middle],
        ['gray', bottom]
    ])
// Only tile #170 goes on a P city in brown (p. 19), and #171 and #172 take Kansas City and St.
// Louis to gray.
const P = { color: 'brown', label: 'P' }
const impassable = (...edges: TileEdge[]) => ({
    borders: edges.map((edge) => ({ edge, kind: 'impassable' as const }))
})

export const Map1870 = new RailwayMap({
    id: '1870',
    name: '1870',
    orientation: HexOrientation.Pointy,
    locations: [
        ...locations('A2', offboard([4, 5], staged(30, 40, 50))),
        ...locations('A22', offboard([0, 1], staged(40, 50, 60))),
        ...locations('N1', offboard([3, 4, 5], staged(20, 40, 50))),
        ...locations('M22', offboard([0, 1, 2], staged(20, 30, 50))),
        ...locations(
            'A4 A6 A8 A12 A14 A18 A20 B3 B5 B15 B21 C2 C4 C6 C8 C10 C12 C20 D1 D3 D7 D11 D19 E2 E4 E6 E10 F1 F3 F7 F17 F21 G4 G6 G8 G12 G14 G16 H1 H9 H11 H15 H19 I2 I4 I6 I12 I18 I20 J1 J7 J13 J17 J19 J21 K2 K6 K8 K12 K18 L1 L3 L5 L7 L9 L15 L17 L19 L21 M4 M12 M16 M18 N3 N5',
            blank
        ),
        ...locations('B9 B19 D5 F5 H13 K16 M2 M6 M20', largeCity),
        ...locations('J3 J5', largeCity, { upgradeLabels: [P] }),
        ...locations('B7 D9 D21 E8 F9 G10 G20 H21 I14 J9 K4 K20 M8 M10', singleTown),
        ...locations('C14 C16 G2 H5', blank, terrain(40)),
        ...locations('H7 I8 J11 K10', blank, terrain(60)),
        ...locations('B11', largeCity, {
            ...terrain(40),
            upgradeLabels: [P, { color: 'gray', label: 'K' }]
        }),
        ...locations('L11', largeCity, terrain(60)),
        ...locations('A10 B13 H3', singleTown, terrain(40)),
        ...locations('I10 E20', doubleTown, terrain(60)),
        ...locations('B17', blank, terrain(40)),
        ...locations('E18 F19 G18 I16 J15', blank, terrain(60)),
        ...locations('L13 N15', blank, terrain(80)),
        ...locations('O16', blank, terrain(100)),
        ...locations('O18', blank, { ...terrain(100), ...impassable(3) }),
        ...locations('C18', largeCity, {
            ...terrain(40),
            upgradeLabels: [P, { color: 'gray', label: 'L' }]
        }),
        ...locations('M14', largeCity, terrain(80)),
        ...locations('H17', largeCity, terrain(60)),
        ...locations('D17', singleTown, terrain(40)),
        ...locations('K14', singleTown, terrain(80)),
        ...locations('A16', doubleTown, terrain(40)),
        ...locations('O2', blank, terrain(60)),
        ...locations('O4 O6 N9 N11 N13', blank, terrain(80)),
        ...locations('N19', blank, { ...terrain(80), ...impassable(0, 1) }),
        ...locations('O14', blank, terrain(100)),
        ...locations('N7', largeCity, terrain(80)),
        ...locations('N17', largeCity, {
            ...terrain(80),
            ...impassable(4),
            upgradeLabels: [P]
        }),
        ...locations('N21', singleTown, terrain(80)),
        ...locations('D13 D15 E14 E16 F11 F13 F15', blank, terrain(60, 'mountain')),
        ...locations('E12', largeCity, terrain(60, 'mountain'))
    ]
})

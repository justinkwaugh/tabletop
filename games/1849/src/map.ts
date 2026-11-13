import { FlatHexDirection, HexOrientation, hexNeighborCoords } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createStagedTileRevenue,
    letterNumberHexCoordinates,
    type MapLocation,
    type TileEdge,
    type TileRevenue
} from '@tabletop/18xx'
import { Dual, Narrow, cityFace, offboardFace, townFace, trackFace, type Exit } from './faces.js'

/**
 * The grey cities and Calabria print three values: the lowest paid in phases 4 and 6, the middle
 * in 8 and 10, the highest in 12 and 16 (§10.5.2).
 */
export const RevenueStages1849 = ['low', 'middle', 'high'] as const

const Names: Readonly<Record<string, string>> = {
    A13: 'Milazzo',
    B14: 'Messina',
    C1: 'Trapani',
    C3: 'Alcamo',
    C5: 'Palermo',
    C9: 'St. Stefano',
    C15: 'Calabria',
    D4: 'Partinico',
    E1: 'Marsala',
    E5: 'Corleone',
    E7: 'Termini Imerese',
    E11: 'Bronte',
    E13: 'Taormina',
    F10: 'Troina',
    F12: 'Etna',
    G1: 'Mazzara',
    G3: 'Castelvetrano',
    G9: 'Castrogiovanni',
    G13: 'Acireale',
    H4: 'Sciacca',
    H8: 'Caltanissetta',
    H12: 'Catania',
    I7: 'Canicatti',
    I9: 'Piazza Armerina',
    J6: 'Girgenti',
    J10: 'Caltagirone',
    K7: 'Licata',
    K13: 'Augusta',
    M9: 'Terranova',
    M11: 'Ragusa',
    M13: 'Siracusa',
    N10: 'Vittoria'
}

// The fixed homes (§7.2); the Garibaldi chooses its own (§9.4.1).
const Homes: Readonly<Record<string, string>> = {
    M13: 'ATA',
    E1: 'CTL',
    H12: 'IFT',
    C5: 'RCS',
    J6: 'SFA'
}

/** Acireale, closed to track until the Società Corriere Etnee is a company's or closed (§7.1). */
export const AcirealeLocationId = 'G13'

const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = {
    [AcirealeLocationId]: [
        {
            id: 'blocks-SCE',
            label: 'SCE',
            privateCompanyId: 'SCE',
            description: 'No track while a player owns the Società Corriere Etnee.'
        }
    ]
}

/** The large cities and the label their own tiles carry (§10.3). */
export const LabelledCities1849: Readonly<Record<string, string>> = {
    C5: 'P',
    H12: 'C',
    B14: 'M',
    M13: 'S'
}
export const MessinaLocationId = 'B14'

/**
 * The cities the Società Marittima Siciliana may reach: every city on the coast, so all but
 * Caltanissetta and Ragusa (§7.1, §10.4).
 */
export const CoastalCityLocationIds: readonly string[] = [
    'B14',
    'C1',
    'C5',
    'E1',
    'H12',
    'J6',
    'M9',
    'M13'
]

/** The port above Milazzo lies beyond row A, so the board prints no coordinate for it. */
export const MilazzoPortLocationId = 'a12'
export const PortLocationIds: readonly string[] = ['A5', MilazzoPortLocationId, 'L14', 'N8']

const Orientation = HexOrientation.Flat
const NumberOffset = 1
const locations = createLetterNumberLocationFactory({
    orientation: Orientation,
    numberOffset: NumberOffset,
    letters: 'rows',
    fixedColors: ['gray', 'blue'],
    names: Names,
    homes: Homes,
    markers: Markers
})

// Rough L. 40, hills L. 80 and mountains L. 160 (§10.3.1).
const TerrainKinds = { 40: 'rough', 80: 'hill', 160: 'mountain' } as const
const terrain = (cost: keyof typeof TerrainKinds) => ({
    terrain: { cost, kinds: [TerrainKinds[cost]] }
})
const impassable = (...edges: TileEdge[]) => ({
    borders: edges.map((edge) => ({ edge, kind: 'impassable' as const }))
})
const staged = (low: number, middle: number, high: number): TileRevenue =>
    createStagedTileRevenue([
        ['low', low],
        ['middle', middle],
        ['high', high]
    ])
const port = (exit: Exit, amount: number) => offboardFace('blue', [exit], { kind: 'fixed', amount })

const blank = trackFace('white', [])
const town = townFace('white', [], 0)
const city = cityFace('white', [], 0, 1)
const greyTown = (exits: readonly Exit[]) => townFace('gray', exits, 10)
const greyCity = (exits: readonly Exit[], slots = 1) =>
    cityFace('gray', exits, staged(20, 30, 40), slots)

const milazzoPort: MapLocation = {
    id: MilazzoPortLocationId,
    coordinates: hexNeighborCoords(
        letterNumberHexCoordinates('B12', Orientation, NumberOffset, 'rows'),
        Orientation,
        FlatHexDirection.North
    ),
    preprintedTile: port(5, 20),
    buildable: false
}

export const Map1849 = new RailwayMap({
    id: '1849',
    name: '1849',
    orientation: Orientation,
    locations: [
        ...locations('H2 L8 O11 B12 J12 D14', blank),
        ...locations('C11', blank, impassable(0)),
        ...locations('B4 C7', blank, impassable(1)),
        ...locations('N12', blank, impassable(2)),
        ...locations('D6', blank, impassable(4)),
        ...locations('D8 D10', blank, impassable(0, 1, 5)),
        ...locations('B2', blank, { ...terrain(40), ...impassable(1) }),
        ...locations('K11', blank, { ...terrain(40), ...impassable(0, 1) }),
        ...locations('H6 H10', blank, terrain(40)),
        ...locations('E3 F6 I5 G7', blank, terrain(80)),
        ...locations('D2 F2 F4 G5 J8 G11 D12 L12', blank, terrain(160)),
        ...locations('F8', blank, { ...terrain(160), ...impassable(3) }),
        ...locations('L10', blank, { ...terrain(160), ...impassable(4) }),
        ...locations('E9', blank, { ...terrain(160), ...impassable(2, 4) }),
        ...locations('G1 G3 K7 N10 G13', town),
        ...locations('C3 E7', town, impassable(4)),
        ...locations('D4 I7 J10', town, terrain(40)),
        ...locations('H4 G9', town, terrain(80)),
        ...locations('E5 I9', town, terrain(160)),
        ...locations('F10', town, { ...terrain(160), ...impassable(3) }),
        ...locations('E11', town, { ...terrain(160), ...impassable(2, 3) }),
        ...locations('H8', city, terrain(80)),
        ...locations('J6', city, terrain(40)),
        ...locations('K9', trackFace('yellow', [[0, 3, Narrow]]), terrain(160)),
        ...locations('I11', trackFace('yellow', [[2, 4]])),
        ...locations('C5', cityFace('yellow', [2, 3, 5], 50, 1, ['P'])),
        ...locations('H12', cityFace('yellow', [1], 40, 1, ['C'])),
        ...locations('M13', cityFace('yellow', [[2, Narrow]], 10, 1, ['S'])),
        ...locations('B14', cityFace('yellow', [0], 30, 1, ['M'])),
        ...locations('M11', cityFace('yellow', [1, [4, Narrow]], 20, 1), {
            ...terrain(40),
            ...impassable(3, 5)
        }),
        milazzoPort,
        ...locations('A5', port(0, 10)),
        ...locations('N8', port([4, Dual], 20)),
        ...locations('L14', port(2, 60)),
        // Calabria is printed grey, as the grey cities whose three values it shares (§10.5.2).
        ...locations('C15', offboardFace('gray', [[4, Dual]], staged(10, 30, 90))),
        ...locations('F12', trackFace('gray', [])),
        // The hex northeast of Messina counts as two (§10.5.1): its halves are A15 and B16, so
        // Messina to Calabria crosses three hex edges.
        ...locations('A15', trackFace('gray', [[1, 5, Dual]])),
        ...locations('B16', trackFace('gray', [[1, 2, Dual]])),
        ...locations(
            'C13',
            trackFace('gray', [
                [1, 4, Narrow],
                [2, 3]
            ])
        ),
        ...locations('C9', greyTown([[0, Narrow], 1, 5])),
        ...locations('E13', greyTown([0, [2, Narrow], 4])),
        ...locations('A13 K13', greyTown([0, 2, 5])),
        ...locations(
            'C1',
            greyCity([
                [0, Dual],
                [5, Dual]
            ]),
            impassable(4)
        ),
        ...locations(
            'E1',
            greyCity([
                [0, Dual],
                [3, Dual],
                [4, Dual],
                [5, Dual]
            ])
        ),
        ...locations('M9', greyCity([[1, Dual], 2, [3, Narrow], [4, Narrow], 5], 2))
    ]
})

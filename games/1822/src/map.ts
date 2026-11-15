import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createCityTileFace as cityFace,
    createLetterNumberLocationFactory,
    createTownTileFace as townFace,
    createTrackTileFace as trackFace,
    type CityReservation,
    type RevenueCenter,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'
import { LondonLocationId, Majors1822, Minors1822 } from './companies.js'
import {
    CityNodeId,
    EnglishChannelUpgradeCost1822,
    LondonUpgradeCost1822,
    englishChannelFace,
    greyCity,
    londonFace,
    phasedRevenue,
    sideEnd,
    terminus,
    through,
    throughTrack,
    HexSides
} from './faces.js'
import { EnglishChannelLocationId } from './privates.js'

const Names: Readonly<Record<string, string>> = {
    A42: 'Cornwall',
    B43: 'Plymouth',
    C34: 'Fishguard',
    C38: 'Barnstaple',
    D11: 'Stranraer',
    D35: 'Swansea & Oystermouth',
    D41: 'Exeter',
    E2: 'Highlands',
    E6: 'Glasgow',
    E28: 'Mid Wales',
    E34: 'Merthyr Tydfil',
    E40: 'Taunton',
    F3: 'Stirling',
    F5: 'Castlecary',
    F7: 'Hamilton & Coatbridge',
    F11: 'Dumfries',
    F23: 'Holyhead',
    F33: 'Pontypool',
    F35: 'Cardiff',
    G4: 'Falkirk',
    G12: 'Carlisle',
    G16: 'Barrow',
    G20: 'Blackpool',
    G22: 'Liverpool',
    G24: 'Chester',
    G28: 'Shrewsbury',
    G32: 'Hereford',
    G34: 'Newport',
    G36: 'Bristol',
    G42: 'Dorchester',
    H1: 'Aberdeen',
    H3: 'Dunfermline',
    H5: 'Edinburgh',
    H13: 'Penrith',
    H17: 'Lancaster',
    H19: 'Preston',
    H21: 'Wigan & Bolton',
    H23: 'Warrington',
    H25: 'Crewe',
    H33: 'Gloucester',
    H37: 'Bath & Radstock',
    I22: 'Manchester',
    I26: 'Stoke-on-Trent',
    I30: 'Birmingham',
    I40: 'Salisbury',
    I42: 'Bournemouth',
    J15: 'Darlington',
    J21: 'Bradford',
    J29: 'Derby',
    J31: 'Coventry',
    J41: 'Southampton',
    K10: 'Newcastle',
    K12: 'Durham',
    K14: 'Middlesbrough',
    K20: 'Leeds',
    K24: 'Sheffield',
    K28: 'Nottingham',
    K30: 'Leicester',
    K36: 'Oxford',
    K38: 'Reading',
    K42: 'Portsmouth',
    L19: 'York',
    L33: 'Northampton',
    M16: 'Scarborough',
    M26: 'Lincoln',
    M30: 'Peterborough',
    M36: 'Hertford',
    M38: 'London',
    M42: 'Brighton',
    N21: 'Hull',
    N23: 'Grimsby',
    N33: 'Cambridge',
    O30: 'King’s Lynn',
    O36: 'Colchester',
    O40: 'Maidstone',
    O42: 'Folkestone',
    P35: 'Ipswich',
    P39: 'Canterbury',
    P41: 'Dover',
    P43: 'English Channel',
    Q30: 'Norwich',
    Q44: 'France'
}

export const FranceLocationId = 'Q44'
export const SwanseaLocationId = 'D35'
export const MidWalesLocationId = 'E28'
export const MerthyrTydfilLocationId = 'E34'
export const PontypoolLocationId = 'F33'
/** The sides of Merthyr Tydfil and of Pontypool that they share (§5.4.7). */
export const MerthyrToPontypoolSide = HexSides.northEast
export const PontypoolToMerthyrSide = HexSides.southWest
/** The second stop of the Swansea & Oystermouth hex (§1.2.2). */
export const OystermouthNodeId = 'town'
/** A route includes the London hex once, whichever of its stations it uses (§5.4.2). */
export const LondonStopGroup = 'London'

/**
 * The six hexes around London, each kept for the company whose London station its side belongs
 * to (§5.10.7), by that station's node.
 */
export const LondonApproachLocationIds: Readonly<Record<string, string>> = {
    s: 'M40',
    sw: 'L39',
    nw: 'L37',
    n: 'M36',
    ne: 'N37',
    se: 'N39'
}

// Each company's home has a station space kept for it (§2.1.11, §5.12.6).
const homes: readonly [string, RevenueCenter][] = [...Majors1822, ...Minors1822].flatMap(
    ({ id, home }) => (home ? [[id, home] as const] : [])
)
const Homes: Readonly<Record<string, readonly CityReservation[]>> = Object.fromEntries(
    [...new Set(homes.map(([, home]) => home.locationId))].map((locationId) => [
        locationId,
        homes
            .filter(([, home]) => home.locationId === locationId)
            .map(([companyId, home]) => ({ companyId, nodeId: home.nodeId }))
    ])
)

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 0,
    fixedColors: ['gray', 'blue'],
    names: Names,
    homes: Homes,
    markers: {}
})

type Details = NonNullable<Parameters<typeof locations>[2]>

// Difficult terrain (§5.8.9): small and large rivers £20 and £40, rough terrain £40, hills £60
// and mountains £80.
const river = (cost: 20 | 40): Details => ({ terrain: { cost, kinds: ['water'] } })
const rough: Details = { terrain: { cost: 40, kinds: ['rough'] } }
const hill: Details = { terrain: { cost: 60, kinds: ['hill'] } }
const mountain: Details = { terrain: { cost: 80, kinds: ['mountain'] } }

/** Track leading up to an estuary costs £40 on its own side of it (§5.8.9). */
export const EstuaryCost1822 = 40

// Red-bordered sides no track may run to (§5.8.6), and estuaries.
const borders = (
    impassable: readonly TileEdge[],
    estuaries: readonly TileEdge[] = []
): Details => ({
    borders: [
        ...impassable.map((edge) => ({ edge, kind: 'impassable' as const })),
        ...estuaries.map((edge) => ({ edge, kind: 'water' as const, cost: EstuaryCost1822 }))
    ]
})
const impassable = (...edges: TileEdge[]) => borders(edges)
const estuary = (...edges: TileEdge[]) => borders([], edges)

// Swansea and three south-coast cities take unlabelled yellow tiles and their own S and T tiles
// from green (§5.8.3).
const labelledFromGreen = (label: string): Details => ({
    upgradeLabels: [{ color: 'green', label }]
})

const blank = trackFace('white', [])
const town = townFace('white', [[]], 0)
const twoTowns = townFace('white', [[], []], 0)
const city = cityFace('white', [], 0, 1)

// An off-shore arrow beside a coastal town: sea a coastal tile may point track at (§5.8.8).
const sea = (landward: TileEdge): TileFace => ({
    color: 'blue',
    nodes: [{ id: 'junction', kind: 'junction' }],
    paths: [
        {
            id: `edge-${landward}`,
            endpoints: [
                { kind: 'edge', edge: landward },
                { kind: 'node', nodeId: 'junction' }
            ]
        }
    ],
    labels: []
})

// Swansea's printed track runs only to Oystermouth, and its first tile is yellow (§1.2.2, §5.8.4).
const swansea: TileFace = {
    color: 'white',
    nodes: [
        { id: CityNodeId, kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 20 } },
        { id: OystermouthNodeId, kind: 'town', revenue: { kind: 'fixed', amount: 10 } }
    ],
    paths: [
        {
            id: 'oystermouth',
            endpoints: [
                { kind: 'node', nodeId: CityNodeId },
                { kind: 'node', nodeId: OystermouthNodeId }
            ]
        }
    ],
    labels: []
}

// France, reached by the two tracks of the brown and grey English Channel (§5.4.6, §5.9.2).
const france: TileFace = {
    color: 'gray',
    nodes: [{ id: 'offboard', kind: 'offboard', revenue: phasedRevenue(0, 60, 90, 120) }],
    paths: [0, 1].map((lane) => ({
        id: lane ? `edge-2-lane-${lane}` : 'edge-2',
        endpoints: [sideEnd(2, lane), { kind: 'node', nodeId: 'offboard' }]
    })),
    labels: []
}

// Mid Wales is one strip of hexes with its station in the middle, reached by eight tracks of its
// own, two from the east side of each of F25, F27, F29 and F31; none joins Holyhead or Pontypool
// (§1.2.4). The outer hexes' tracks run along the strip through the inner ones to the station,
// and each track names first the side it is reached by.
const midWalesOuter = (inward: TileEdge) =>
    throughTrack([
        [4, inward, 0, 0],
        [5, inward, 0, 1]
    ])
const midWalesInner = (outer: TileEdge, inward: TileEdge) =>
    throughTrack([
        [outer, inward, 0, 0],
        [outer, inward, 1, 1],
        [4, inward, 0, 2],
        [5, inward, 0, 3]
    ])

/**
 * The standard grey off-board areas, whose stations end a route (§5.4.4), each as the hexes the
 * board prints as one area: the Highlands with the hex of its track down to Glasgow, Aberdeen,
 * Cornwall, Fishguard, Holyhead, and Mid Wales with its eight tracks. France is the seventh, an
 * off-board area of its own kind.
 */
export const OffBoardAreas1822: readonly (readonly string[])[] = [
    ['E2', 'E4'],
    ['H1'],
    ['A42'],
    ['C34'],
    ['F23'],
    [MidWalesLocationId, 'F25', 'F27', 'F29', 'F31']
]

export const Map1822 = new RailwayMap({
    id: '1822',
    name: '1822',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations(
            'B39 C10 D9 E8 E12 F41 G2 G6 G26 G38 G40 H11 H27 H29 H31 H41 I6 I28 I34 I36 J9 J11 J13 J17 J27 J33 J35 J37 K8 K16 K18 K22 K26 K32 K34 K40 L15 L17 L23 L25 L27 L29 L31 L35 L37 L39 L41 M18 M20 M24 M32 M34 M40 N19 N25 N31 N35 N41 O32 O34 P27 P29 P31 P33 Q28 Q32 Q34',
            blank
        ),
        ...locations('H43', blank, impassable(4)),
        ...locations('D37', blank, impassable(3, 4)),
        ...locations('N27', blank, impassable(0, 5)),
        ...locations('E36', blank, impassable(0, 1, 5)),
        ...locations('G10', blank, estuary(0)),
        ...locations('O38', blank, borders([5], [2, 3])),
        ...locations('N37', blank, estuary(0, 5)),
        ...locations('C42 F39 L21 M28', blank, river(20)),
        ...locations('O28', blank, { ...river(20), ...impassable(1, 2) }),
        ...locations('E38', blank, { ...river(20), ...impassable(3) }),
        ...locations('H35', blank, { ...river(20), ...estuary(2) }),
        ...locations('N39', blank, { ...river(20), ...estuary(3) }),
        ...locations('F37', blank, { ...river(20), ...impassable(2, 3) }),
        ...locations('D43 I32 M22', blank, river(40)),
        ...locations('N29', blank, { ...river(40), ...impassable(3, 4) }),
        ...locations('B41 D39 G14 G30 H39 I12 I24 I38 J39', blank, rough),
        ...locations('C40 E10 F9 G8 H7 H9 H15 I8 I10 J7 J23 J25', blank, hill),
        ...locations('I14 I16 I18 I20 J19', blank, mountain),
        ...locations(
            'C38 D11 E40 F3 F5 G20 G28 G32 G42 H13 H25 I26 J31 K12 K36 M16 M26 M36 N33 O42',
            town
        ),
        ...locations('H17 P39', town, impassable(2)),
        ...locations('H3', town, borders([1], [0])),
        ...locations('F11', town, impassable(5)),
        ...locations('O36', town, estuary(0)),
        ...locations('O30', town, river(20)),
        ...locations('G34', town, { ...river(20), ...estuary(0, 5) }),
        ...locations('G24', town, river(40)),
        ...locations('I40', town, rough),
        ...locations('J21', town, hill),
        ...locations('F7 H21', twoTowns),
        ...locations('H37', twoTowns, river(20)),
        ...locations('D41 H19 J15 J29 J41 K10 K14 K20 K24 K28 K30 K38 L33 M30 P35 P41', city),
        ...locations('I42', city, impassable(1)),
        ...locations('G4', city, impassable(4)),
        ...locations('G16', city, impassable(5)),
        ...locations('G12', city, borders([2], [3])),
        ...locations('B43 K42 M42', city, labelledFromGreen('T')),
        ...locations('L19 Q30', city, river(20)),
        ...locations('H23 H33', city, river(40)),
        ...locations('O40', city, rough),
        ...locations('N21', city, { ...river(20), ...estuary(0) }),
        ...locations('N23', city, { ...river(20), ...estuary(3) }),
        ...locations(SwanseaLocationId, swansea, {
            ...impassable(0),
            ...labelledFromGreen('S')
        }),
        // London's stations are worth £20 before its first upgrade, and each upgrade costs £20
        // (§5.10.1).
        ...locations(LondonLocationId, londonFace('white', 20, LondonUpgradeCost1822), {
            stopGroup: LondonStopGroup
        }),
        // The pre-printed yellow hexes (§5.8.4), some with terrain to pay on their upgrade
        // (§5.8.10).
        ...locations('F35', cityFace('yellow', [1, 2, 4], 30, 2, ['C']), impassable(0, 5)),
        ...locations('G22', cityFace('yellow', [0, 3, 5], 30, 2, ['Y'])),
        ...locations('G36', cityFace('yellow', [0, 4, 5], 30, 2, ['Y']), {
            ...river(20),
            ...borders([2], [3])
        }),
        ...locations('H5', cityFace('yellow', [1, 2, 5], 30, 2, ['Y']), estuary(3)),
        ...locations('I22', cityFace('yellow', [0, 1, 4], 40, 2, ['BM']), hill),
        ...locations('I30', cityFace('yellow', [0, 2, 4], 40, 2, ['BM']), river(40)),
        // The English Channel has no track until its green tile (§5.9.1).
        ...locations(
            EnglishChannelLocationId,
            englishChannelFace('yellow', 1, [], EnglishChannelUpgradeCost1822)
        ),
        // The grey areas (§5.4.4, §5.4.5). The standard off-board areas are termini.
        ...locations('A42', greyCity(phasedRevenue(40, 30, 30, 40), 2, [terminus(4), terminus(5)])),
        ...locations('C34', greyCity(phasedRevenue(10, 20, 30, 40), 2, [terminus(5)])),
        ...locations('F23', greyCity(phasedRevenue(20, 20, 30, 40), 2, [terminus(5)])),
        ...locations('H1', greyCity(phasedRevenue(30, 40, 50, 60), 2, [terminus(0), terminus(1)])),
        ...locations(
            'E6',
            greyCity(phasedRevenue(40, 50, 60, 70), 3, [
                through(0),
                through(3),
                through(4),
                through(5)
            ])
        ),
        // Merthyr Tydfil and Pontypool share a side, and one track across it joins them: a route
        // that crosses ends at the city it reaches, and only one train a turn crosses (§5.4.7).
        ...locations(
            MerthyrTydfilLocationId,
            greyCity(phasedRevenue(30, 40, 30, 10), 2, [
                terminus(MerthyrToPontypoolSide),
                through(5)
            ])
        ),
        ...locations(
            PontypoolLocationId,
            greyCity(phasedRevenue(20, 40, 30, 10), 2, [
                terminus(PontypoolToMerthyrSide),
                through(5)
            ])
        ),
        ...locations('E2', greyCity(phasedRevenue(10, 10, 20, 20), 2, [terminus(0), terminus(5)])),
        ...locations('E4', throughTrack([[0, 3]])),
        ...locations('F25', midWalesOuter(0)),
        ...locations('F27', midWalesInner(3, 1)),
        ...locations('F29', midWalesInner(0, 2)),
        ...locations('F31', midWalesOuter(3)),
        ...locations(
            MidWalesLocationId,
            greyCity(phasedRevenue(10, 20, 20, 30), 3, [terminus(4, 4), terminus(5, 4)])
        ),
        ...locations(FranceLocationId, france),
        ...locations('L11 J43 Q36 Q42 R31', sea(2)),
        ...locations('F17', sea(4)),
        ...locations('F15 F21', sea(5))
    ]
})

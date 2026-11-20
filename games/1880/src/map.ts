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
    type TileEdge,
    type TileFace,
    type TileNode,
    type TilePath,
    type TileRevenue
} from '@tabletop/18xx'
import {
    BcrId,
    BzuId,
    CkrId,
    HkrId,
    JggId,
    JhaId,
    JhuId,
    JlrId,
    LhrId,
    NjrId,
    NxrId,
    QsrId,
    ScrId,
    WnrId
} from './ids.js'
import { BeijingLabel, OOLabel, ShanghaiLabel } from './tiles.js'

export const BeijingLocationId = 'F8'
export const ShanghaiLocationId = 'K15'
export const TaiwanLocationId = 'N16'
export const RussiaLocationId = 'A3'
export const VladivostokLocationId = 'A15'
/** The three ferries, each charging ¥10 a route that uses it (§X Calculating Income). */
export const FerryLocationIds: readonly string[] = ['F12', 'F14', 'J16']
/** The OO hexes whose two cities are a home: the QSR's and the SCR's (§X Placing station markers). */
export const SharedHomeLocationIds: readonly string[] = ['D12', 'N12']

/**
 * The small starting sections of track printed around Beijing: every tile laid in the hex keeps
 * the connection (§X Laying Track).
 */
export const PrintedStubs1880: Readonly<Record<string, TileEdge>> = {
    E9: 0,
    F6: 4,
    F10: 1,
    G7: 3
}

/** Off-board and harbour values in phases A, B, C and D (§X Calculating Income). */
export const RevenueStages1880 = ['A', 'B', 'C', 'D'] as const

const Names: Readonly<Record<string, string>> = {
    A3: 'Russia',
    A5: 'Qiqihar',
    A15: 'Vladivostok',
    B8: 'Harbin',
    C9: 'Changchun',
    C11: 'Jilin City',
    D12: 'Shenyang & Fushun',
    E13: 'Dalian',
    F4: 'Hohhot & Datong',
    F8: 'Beijing',
    F10: 'Tianjin',
    G3: 'Baotou',
    H6: 'Taiyuan',
    H10: 'Jinan',
    H14: 'Qingdao',
    I1: 'Ürümqi',
    I9: 'Kaifeng & Zhengzhou',
    J2: 'Lanzhou',
    J6: 'Xi’an',
    J12: 'Hefei',
    K1: 'Lhasa',
    K13: 'Nanjing',
    K15: 'Shanghai',
    L10: 'Wuhan',
    M3: 'Chengdu',
    M7: 'Chongqing',
    N12: 'Changsha & Nanchang',
    N16: 'Taiwan',
    O5: 'Kunming',
    P8: 'Nanning',
    P12: 'Macau',
    P14: 'Guangzhou',
    Q7: 'French Indochina',
    Q13: 'Haikou',
    Q15: 'Hong Kong'
}

/** Each foreign investor's home base (§VII). */
export const InvestorHomes1880 = {
    A1: RussiaLocationId,
    A2: 'E13',
    A3: 'H6',
    A4: 'H14',
    A5: 'Q15',
    A6: 'P12',
    A7: 'Q7'
} as const

/** Beijing's four printed cities, by the side each faces (§VIII). */
export const BeijingCityIds = {
    [JggId]: 'city-0',
    [JlrId]: 'city-1',
    [JhaId]: 'city-2',
    [JhuId]: 'city-3'
} as const

const Homes: Readonly<Record<string, string | CityReservation | readonly CityReservation[]>> = {
    [BeijingLocationId]: Object.entries(BeijingCityIds).map(([companyId, nodeId]) => ({
        companyId,
        nodeId
    })),
    B8: BzuId,
    J2: LhrId,
    O5: CkrId,
    M3: BcrId,
    J6: NxrId,
    K15: HkrId,
    K13: NjrId,
    L10: WnrId,
    D12: QsrId,
    N12: ScrId,
    ...Object.fromEntries(
        Object.entries(InvestorHomes1880).map(([investorId, locationId]) => [
            locationId,
            investorId
        ])
    )
}

/** Each major's home hex (§VIII). */
export const MajorHomes1880: Readonly<Record<string, string>> = {
    [JhaId]: BeijingLocationId,
    [JhuId]: BeijingLocationId,
    [JggId]: BeijingLocationId,
    [JlrId]: BeijingLocationId,
    [BzuId]: 'B8',
    [LhrId]: 'J2',
    [ScrId]: 'N12',
    [CkrId]: 'O5',
    [BcrId]: 'M3',
    [NxrId]: 'J6',
    [HkrId]: ShanghaiLocationId,
    [NjrId]: 'K13',
    [QsrId]: 'D12',
    [WnrId]: 'L10'
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 1,
    fixedColors: ['red', 'blue'],
    names: Names,
    homes: Homes,
    markers: Object.fromEntries(
        FerryLocationIds.map((id) => [
            id,
            [
                {
                    id: id === 'F12' ? 'ferry' : 'ferry-curved',
                    label: '−10',
                    description:
                        'A ferry: each route crossing it earns ¥10 less, unless the company’s director owns P2.'
                }
            ]
        ])
    )
})

type Details = NonNullable<Parameters<typeof locations>[2]>

const mountain = (cost: number): Details => ({ terrain: { cost, kinds: ['mountain'] } })
const river = (cost: number): Details => ({ terrain: { cost, kinds: ['water'] } })
const mountainRiver = (cost: number): Details => ({
    terrain: { cost, kinds: ['mountain', 'water'] }
})

const phased = (a: number, b: number, c: number, d: number): TileRevenue =>
    createStagedTileRevenue([
        ['A', a],
        ['B', b],
        ['C', c],
        ['D', d]
    ])

const terminus = (nodeId: string, edges: readonly TileEdge[]): TilePath[] =>
    edges.map((edge) => ({
        id: `edge-${edge}`,
        endpoints: [
            { kind: 'edge', edge },
            { kind: 'node', nodeId }
        ],
        terminus: true
    }))

/** A red off-board area with a city a foreign investor starts in, ending every route. */
function offboardCity(edges: readonly TileEdge[], revenue: TileRevenue): TileFace {
    return {
        color: 'red',
        labels: [],
        nodes: [{ id: 'city', kind: 'city', stationSlots: 1, revenue }],
        paths: terminus('city', edges)
    }
}

/** A blue harbour: a small station at the end of a route (§X Operating Trains). */
function harbour(edges: readonly TileEdge[], revenue: TileRevenue): TileFace {
    return {
        color: 'blue',
        labels: [],
        nodes: [{ id: 'town', kind: 'town', revenue }],
        paths: terminus('town', edges)
    }
}

const ferry = (from: TileEdge, to: TileEdge): TileFace => trackFace('blue', [[from, to]])

const blank = trackFace('white', [])
const town = townFace('white', [[]], 0)
const twoTowns = townFace('white', [[], []], 0)
const city = cityFace('white', [], 0, 1)
const twoCities = citiesFace(
    'white',
    [
        { edges: [], revenue: 0, stationSlots: 1 },
        { edges: [], revenue: 0, stationSlots: 1 }
    ],
    [OOLabel]
)

/**
 * A medium city ("boomtown"): its first yellow tile is a town or a city, chosen by the tile laid
 * (§X Laying Track). Printed as a town within a city.
 */
export const BoomtownNodes: readonly TileNode[] = [
    { id: 'boomtown-city', kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 0 } },
    { id: 'boomtown-town', kind: 'town', revenue: { kind: 'fixed', amount: 0 } }
]
const boomtown: TileFace = { color: 'white', nodes: [...BoomtownNodes], paths: [], labels: [] }
/** A double medium city: two towns or an OO city, chosen by the yellow tile laid. */
const doubleBoomtown: TileFace = {
    color: 'white',
    nodes: [0, 1].flatMap((index): TileNode[] => [
        {
            id: `boomtown-city-${index}`,
            kind: 'city',
            stationSlots: 1,
            revenue: { kind: 'fixed', amount: 0 }
        },
        { id: `boomtown-town-${index}`, kind: 'town', revenue: { kind: 'fixed', amount: 0 } }
    ]),
    paths: [],
    labels: []
}

/** Whether the printed hex is a medium city or a double one, whose first tile chooses. */
export function isBoomtown(face: TileFace): boolean {
    return face.nodes.some((node) => node.id.startsWith('boomtown-'))
}

/** The printed yellow Beijing: four cities, each with a starting section (§X Laying Track). */
const beijing = citiesFace(
    'yellow',
    [
        { edges: [0], revenue: 20, stationSlots: 1 },
        { edges: [1], revenue: 20, stationSlots: 1 },
        { edges: [3], revenue: 20, stationSlots: 1 },
        { edges: [4], revenue: 20, stationSlots: 1 }
    ],
    [BeijingLabel]
)

export const Map1880 = new RailwayMap({
    id: '1880',
    name: '1880: China',
    orientation: HexOrientation.Pointy,
    locations: [
        // The red off-board areas; Russia, Hong Kong and French Indochina hold a foreign investor.
        ...locations(RussiaLocationId, offboardCity([4, 5], phased(20, 30, 40, 50))),
        ...locations(VladivostokLocationId, createOffboardTileFace([0, 1], phased(10, 20, 30, 40))),
        ...locations('I1', createOffboardTileFace([3, 4, 5], phased(10, 20, 30, 40))),
        ...locations('K1', createOffboardTileFace([3, 4, 5], phased(0, 0, 0, 80))),
        ...locations('Q7', offboardCity([2, 3], phased(30, 40, 50, 60))),
        ...locations('Q15', offboardCity([2], phased(20, 30, 10, 70))),
        // The harbours, small stations at a route's end.
        ...locations(TaiwanLocationId, harbour([0, 1, 2], phased(30, 30, 0, 0))),
        ...locations('Q13', harbour([2, 3], phased(20, 30, 40, 50))),
        // The ferries, and the water track to Shanghai.
        ...locations('F12', ferry(3, 1)),
        ...locations('F14 J16', ferry(2, 0)),
        ...locations('I15', ferry(2, 5)),
        ...locations(BeijingLocationId, beijing),
        ...locations(
            'A9 A11 A13 B6 B10 C13 D10 E15 F2 G13 I11 I13 J10 K11 M9 M11 M13 N14 O13',
            blank
        ),
        ...locations('G7', blank),
        ...locations('B4 C3 C5 C15 D6 D8 E3 E5 E7 H2 I3 J4 K3 K9 L4 L6 N8 O9', blank, mountain(30)),
        ...locations('L2 M1 N2 P2', blank, mountain(40)),
        ...locations('G1 H4 I5 N6', blank, river(20)),
        ...locations('G5 I7 L8', blank, mountainRiver(50)),
        ...locations('O1', blank, mountainRiver(60)),
        ...locations('J2', city, mountainRiver(50)),
        ...locations('G3 H10 K13 L10 M7', city, river(20)),
        ...locations('I9', twoCities, river(20)),
        ...locations('G11 J14', town, river(20)),
        ...locations('L12 O3', twoTowns, river(20)),
        ...locations('A5 B8 C9 C11 H6 H14 J12 M3 O5 P8 P12 P14', city),
        ...locations('F10', city),
        ...locations(ShanghaiLocationId, cityFace('white', [], 0, 1, [ShanghaiLabel])),
        ...locations('A7 C7 D14 G9 G15 L16 M15 P6', town),
        ...locations('B12 H12 O11', twoTowns),
        ...locations('B14 L14 N10 E9', boomtown),
        ...locations('F6', boomtown, mountain(30)),
        ...locations('H8', doubleBoomtown),
        ...locations('N4', doubleBoomtown, river(20)),
        ...locations('D4 K5 K7 M5 O15 P10', town, mountain(30)),
        ...locations('P4', town, mountain(40)),
        ...locations('J8', twoTowns, mountain(30)),
        ...locations('J6', city, mountain(30)),
        ...locations('O7', boomtown, mountain(30)),
        ...locations('D12 F4 N12', twoCities),
        ...locations('E11', blank, { borders: [{ edge: 4, kind: 'impassable' }] }),
        ...locations('E13', city, { borders: [{ edge: 1, kind: 'impassable' }] })
    ]
})

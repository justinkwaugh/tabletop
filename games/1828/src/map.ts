import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createStagedTileRevenue,
    createTrackTileFace as track,
    createTownTileFace as town,
    createCityTileFace as city,
    createSeparateCitiesTileFace as cities,
    createOffboardTileFace as offboard,
    type CityReservation,
    type MapLocation,
    type TileEdge,
    type TileFace,
    type TileRevenue
} from '@tabletop/18xx'
import {
    BmId,
    BoId,
    CaId,
    CoId,
    CpId,
    CprId,
    CslId,
    DhId,
    EkId,
    ErieId,
    GtId,
    IcId,
    McId,
    MhId,
    MpId,
    NkpId,
    NwId,
    NycId,
    NyhId,
    OshId,
    PrrId,
    StctId,
    SvnId,
    WabId
} from './ids.js'

const Names: Readonly<Record<string, string>> = {
    A3: 'Copper Country',
    A5: 'Marquette',
    A7: 'Mackinaw City',
    A15: 'Canada',
    A23: 'Montreal',
    B14: 'Barrie',
    B20: 'Ottawa',
    B24: 'Burlington',
    B28: 'Maine',
    C5: 'Muskegon',
    C15: 'Peterborough',
    C19: 'Kingston',
    D4: 'Grand Rapids',
    D6: 'Lansing',
    D8: 'Flint',
    D10: 'Sarnia',
    D14: 'Hamilton/Toronto',
    D18: 'Rochester',
    D24: 'Schenectady',
    E7: 'Adrian/Ann Arbor',
    E9: 'Detroit/Windsor',
    E15: 'Buffalo/Dunkirk',
    E23: 'Albany',
    E27: 'Boston',
    F8: 'Toledo',
    F10: 'Cleveland',
    F14: 'Erie',
    F20: 'Scranton',
    F24: 'New Haven/Hartford',
    F26: 'Providence',
    F28: 'Mansfield',
    G3: 'Chicago',
    G11: 'Akron/Canton',
    G21: 'Reading/Allentown',
    G23: 'Newark/New York',
    H6: 'Louisville',
    H8: 'Cincinnati',
    H12: 'Pittsburgh',
    H14: 'Johnstown',
    H16: 'Altoona',
    H20: 'Lancaster',
    H22: 'Philadelphia/Trenton',
    I1: 'West',
    I3: 'St Louis',
    I11: 'Washington',
    I19: 'Baltimore',
    I23: 'Atlantic City',
    J6: 'Nashville',
    J18: 'Washington',
    K3: 'New Orleans',
    K11: 'Virginia Coalfields',
    K13: 'Virginia Coalfields Tunnel',
    K15: 'Richmond',
    K19: 'Norfolk',
    L16: 'Deep South',
    L18: 'Suffolk'
}

/** The Virginia Coalfields, where only companies holding a coal marker may run or build (§14.3.1.1). */
export const CoalfieldsLocationId = 'K11'
/** The Virginia Coalfields Tunnel, taking only tile #4 (§14.3.1.2). */
export const TunnelLocationId = 'K13'
/** Peterborough, where the Cobourg & Peterborough's station stands (§13.2.2.5). */
export const PeterboroughLocationId = 'C15'
/** Buffalo/Dunkirk, the Erie's home, either city of it (§13.3.2). */
export const ErieHomeLocationId = 'E15'
/** Adrian & Ann Arbor, where the Erie & Kalamazoo's tile goes (§13.2.2.7). */
export const AdrianLocationId = 'E7'

/** Where the public companies start: New York's NYH city is its right-hand one (table 13.1). */
export const Homes1828: Readonly<Record<string, string | CityReservation>> = {
    E27: BmId,
    I19: BoId,
    K15: CoId,
    A23: CprId,
    D4: GtId,
    E15: ErieId,
    J6: IcId,
    A7: McId,
    I3: MpId,
    E23: NycId,
    F10: NkpId,
    G23: { companyId: NyhId, nodeId: 'city-1' },
    K19: NwId,
    A15: OshId,
    H16: PrrId,
    H6: WabId
}

/** The hexes each saleable private blocks while a player owns it (§13.2.2). */
export const PrivateBlocks1828: Readonly<Record<string, readonly string[]>> = {
    [SvnId]: ['G19'],
    [StctId]: ['D10'],
    [CslId]: ['B24'],
    [DhId]: ['F20'],
    [CpId]: [PeterboroughLocationId],
    [MhId]: ['D22'],
    [EkId]: [AdrianLocationId],
    [CaId]: ['H22']
}

export const PrivateInitials1828: Readonly<Record<string, string>> = {
    [SvnId]: 'SVN',
    [StctId]: 'StCT',
    [CslId]: 'C&StL',
    [DhId]: 'D&H',
    [CpId]: 'C&P',
    [MhId]: 'M&H',
    [EkId]: 'E&K',
    [CaId]: 'C&A'
}

function markers(): Record<string, NonNullable<MapLocation['markers']>> {
    const result: Record<string, NonNullable<MapLocation['markers']>> = {}
    for (const [privateCompanyId, locationIds] of Object.entries(PrivateBlocks1828))
        for (const locationId of locationIds)
            result[locationId] = [
                {
                    id: `blocks-${privateCompanyId}`,
                    label: PrivateInitials1828[privateCompanyId],
                    privateCompanyId,
                    description: `No track while ${PrivateInitials1828[privateCompanyId]} is player-owned.`
                }
            ]
    return result
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 1,
    fixedColors: ['gray', 'red'],
    names: Names,
    homes: Homes1828,
    markers: markers()
})

const water = { terrain: { cost: 80, kinds: ['water'] } }
const mountain = { terrain: { cost: 120, kinds: ['mountain'] } }
const impassable = (...edges: TileEdge[]) => ({
    borders: edges.map((edge) => ({ edge, kind: 'impassable' as const }))
})

const blank = track('white', [])
const emptyCity = city('white', [], 0, 1)
const emptyTown = town('white', [[]], 0)
const twoTowns = town('white', [[], []], 0)

// Revenue centres with two values pay the second from brown phase (§11, §17.4).
const staged = (yellow: number, brown: number): TileRevenue =>
    createStagedTileRevenue([
        ['yellow', yellow],
        ['brown', brown]
    ])

/** A yellow OO hex printed without track: two empty cities, upgraded by an OO tile. */
const printedOO = cities(
    'yellow',
    [
        { edges: [], revenue: 0, stationSlots: 1 },
        { edges: [], revenue: 0, stationSlots: 1 }
    ],
    ['OO']
)

/** Altoona's city beside the through track that bypasses it (PRR's home). */
const Altoona: TileFace = {
    ...city('gray', [1, 2, 3, 4], staged(20, 30), 1),
    paths: [
        ...city('gray', [1, 2, 3, 4], staged(20, 30), 1).paths,
        {
            id: 'bypass',
            endpoints: [
                { kind: 'edge', edge: 1 },
                { kind: 'edge', edge: 4 }
            ]
        }
    ]
}

/**
 * The OS&H's home in Canada, a red city whose track ends there: routes start or end in Canada
 * but never run through it (§11, §13.3.2).
 */
const CanadaCity: TileFace = {
    ...city('red', [0, 1, 5], staged(30, 50), 1),
    paths: city('red', [0, 1, 5], staged(30, 50), 1).paths.map((path) => ({
        ...path,
        terminus: true as const
    }))
}

/** Canada's western hex carries track from Barrie into Canada's city (§11). */
const CanadaWest: TileFace = track('red', [[5, 4]])

/** The Virginia Coalfields: a revenue centre with no station spaces (§11, §14.3.1.1). */
const Coalfields: TileFace = city('gray', [2, 3, 4], staged(30, 60), 0)

export const Map1828 = new RailwayMap({
    id: '1828',
    name: '1828',
    orientation: HexOrientation.Pointy,
    locations: [
        ...locations('A3', offboard([4], { kind: 'fixed', amount: 60 })),
        ...locations('A13', CanadaWest),
        ...locations('A15', CanadaCity),
        ...locations('B28', offboard([0, 1], staged(20, 30))),
        ...locations('G3', offboard([0, 4, 5], staged(40, 70))),
        ...locations('I1', offboard([3, 4, 5], staged(20, 60))),
        ...locations('K3 L16', offboard([2, 3], staged(30, 40))),

        ...locations('A5', town('gray', [[1, 4]], 20)),
        ...locations('A7', city('gray', [1, 5], 30, 1)),
        ...locations('A21', track('gray', [[0, 5]])),
        ...locations('A23', city('gray', [0, 5], 40, 1)),
        ...locations('C5', town('gray', [[0, 3, 5]], 10)),
        ...locations('C19', town('gray', [[1, 3]], 10)),
        ...locations('D4', city('gray', [3, 4, 5], 30, 1)),
        ...locations('D18', city('gray', [0, 1, 4], 20, 1)),
        ...locations('D24', city('gray', [0, 1, 5], 30, 1)),
        ...locations(
            'D28',
            track('gray', [
                [0, 1],
                [0, 2]
            ])
        ),
        ...locations('E13', track('gray', [[2, 3]])),
        ...locations('F10', city('gray', [0, 1, 5], staged(30, 40), 1)),
        ...locations('F28 I23', town('gray', [[1, 2]], 10)),
        ...locations('H16', Altoona),
        ...locations(CoalfieldsLocationId, Coalfields),
        ...locations('K19', city('gray', [0, 1, 2], staged(30, 40), 1)),
        ...locations('L18', town('gray', [[2, 3]], 10)),

        ...locations(
            'B16 B18 B26 C7 C13 C27 D12 D20 D22 E5 E17 E19 F6 F16 F18 F22 G5 G7 G9 G13 G15 H4 H10 H18 I5 I7 I9 I13 I17 J4 J8 J10 J12 K17',
            blank
        ),
        ...locations('C17', blank, impassable(0)),
        ...locations('D16', blank, impassable(2, 3)),
        ...locations('F12', blank, impassable(2)),
        ...locations('B6 B8 B22 C23 H2 I21 J2', blank, water),
        ...locations('E11', blank, { ...water, ...impassable(5) }),
        ...locations('C21', blank, { ...mountain, ...impassable(2) }),
        ...locations('C25 D26 E21 E25 G17 G19 I15 J14 J16', blank, mountain),
        ...locations('B14 D6 F8 F26 I3 J18', emptyCity, water),
        ...locations('B20', emptyCity, impassable(5)),
        ...locations('D8 E23 H6 H8 H12 H20 K15', emptyCity),
        ...locations('F20', emptyCity, mountain),
        ...locations('B24 D10 F14 H14 I11', emptyTown),
        ...locations(TunnelLocationId, emptyTown, mountain),
        ...locations('E7 F24 G11 G21', twoTowns),

        ...locations(PeterboroughLocationId, city('yellow', [0, 1, 4], 20, 1), {
            ...water,
            ...impassable(5)
        }),
        ...locations('D14 E9', printedOO, water),
        ...locations('E15 H22', printedOO),
        ...locations('E27', city('yellow', [3, 5], 30, 1, ['Bo'])),
        ...locations(
            'G23',
            cities(
                'yellow',
                [
                    { edges: [0], revenue: 40, stationSlots: 1 },
                    { edges: [3], revenue: 40, stationSlots: 1 }
                ],
                ['NY']
            ),
            water
        ),
        ...locations('I19', city('yellow', [0, 4], 30, 1, ['Ba'])),
        ...locations('J6', city('yellow', [1, 4], 20, 1))
    ]
})

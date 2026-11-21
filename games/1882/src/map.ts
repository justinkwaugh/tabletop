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
    type MapLocation,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'
import { CnorId, CprId, GtpId, HbId, HbrId, ScId, TbId } from './ids.js'
import { NeutralStations1882 } from './neutralStationDefinitions.js'

const Names: Readonly<Record<string, string>> = {
    I1: 'Western Canada',
    B2: 'Northern Alberta',
    L2: 'Lethbridge',
    C3: 'Lloydminster',
    G3: 'Kindersley',
    K3: 'Medicine Hat',
    M3: 'Elkwater',
    D4: 'Maidstone',
    F4: 'Wilkie',
    E5: 'North Battleford & Battleford',
    I5: 'Swift Current',
    B6: 'Fishing',
    D6: 'Spiritwood',
    N6: 'Shaunavon',
    G7: 'Saskatoon',
    D8: 'Prince Albert',
    F8: 'Rosthern & Melfort',
    J8: 'Moose Jaw',
    L8: 'Assiniboia',
    C9: 'Candle Lake',
    G9: 'Humboldt',
    K9: 'Rouleau & Mossbank',
    J10: 'Regina',
    A11: 'Sandy Bay',
    C11: 'Flin Flon',
    G11: 'Wadena',
    I11: 'Melville & Fort Qu’Appelle',
    M11: 'Weyburn & Estevan',
    O11: 'USA',
    B12: 'Hudson Bay',
    J12: 'Moosomin',
    L12: 'Carlyle',
    N12: 'Oxbow',
    I13: 'Eastern Canada',
    K13: 'Virden'
}

/** Where the companies start (§10.4); the QL chooses either of Regina's cities (note 1). */
export const Homes1882: Readonly<Record<string, string>> = {
    D8: CnorId,
    I5: CprId,
    L8: GtpId,
    G11: HbrId
}
export const QLHome = 'J10'

/** The hexes marked for the North-West Rebellion (§7.1.3, §8). */
export const RebellionLocations = ['B4', 'C3', 'C5', 'D4', 'D6', 'E3', 'E5', 'E7', 'F6']
/** The rebellion hexes with a city, where the NWR may move a station (§7.1.3). */
export const RebellionCities = ['C3', 'D4', 'D6', 'E5']

/** Hudson Bay with Northern Alberta or Western Canada adds $100 to a route (§11.5). */
export const HudsonBay = 'B12'
export const WesternExits = ['B2', 'I1']
export const HudsonBayBonus = 100
export const FishingExit = 'B6'

const PrivateBlocks: Readonly<Record<string, { privateCompanyId: string; name: string }>> = {
    C11: { privateCompanyId: HbId, name: 'Hudson Bay' },
    H4: { privateCompanyId: ScId, name: 'Saskatchewan Central' },
    G9: { privateCompanyId: TbId, name: 'Trestle Bridge' }
}

function markers(): Record<string, NonNullable<MapLocation['markers']>> {
    const result: Record<string, NonNullable<MapLocation['markers']>> = {}
    const add = (id: string, marker: NonNullable<MapLocation['markers']>[number]) => {
        result[id] = [...(result[id] ?? []), marker]
    }
    for (const id of RebellionLocations)
        add(id, {
            id: 'nwr',
            label: 'NWR',
            description:
                'North-West Rebellion: a yellow tile laid here earns $20; the rebellion removes laid yellow tiles.'
        })
    for (const [id, { privateCompanyId, name }] of Object.entries(PrivateBlocks))
        add(id, {
            id: `blocks-${privateCompanyId}`,
            label: privateCompanyId,
            privateCompanyId,
            description: `No track while ${name} is player-owned.`
        })
    for (const id of [HudsonBay, ...WesternExits])
        add(id, {
            id: 'hudson-bay',
            label: '+100',
            description:
                'A route joining Hudson Bay to Northern Alberta or Western Canada earns $100 more.'
        })
    add(FishingExit, {
        id: 'fishing',
        label: 'Fishing',
        description:
            'The fishing exit may end a route as a stop, or be added to a route without counting against the train.'
    })
    return result
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 1,
    letters: 'rows',
    fixedColors: ['gray', 'red', 'blue'],
    names: Names,
    homes: Homes1882,
    markers: markers()
})

type River = readonly [edge: TileEdge, cost: number]
const rivers = (...entries: readonly River[]): Pick<MapLocation, 'borders'> => ({
    borders: entries.map(([edge, cost]) => ({ edge, kind: 'water' as const, cost }))
})
const impassable = (...edges: readonly TileEdge[]) =>
    edges.map((edge) => ({ edge, kind: 'impassable' as const }))

const blank = track('white', [])
const emptyCity = city('white', [], 0, 1)
const emptyTown = town('white', [[]], 0)
const twoTowns = town('white', [[], []], 0)
const exit = (edges: readonly TileEdge[], early: number, late: number) =>
    offboard(
        edges,
        revenue([
            ['yellow', early],
            ['brown', late]
        ])
    )

/** The fishing exit: an off-board area that need not count against a train (§11.5). */
const Fishing: TileFace = {
    ...exit([0, 1], 20, 30),
    color: 'blue',
    nodes: [
        {
            id: 'offboard',
            kind: 'offboard',
            uncounted: true,
            revenue: revenue([
                ['yellow', 20],
                ['brown', 30]
            ])
        }
    ]
}

export const Map1882 = new RailwayMap(
    {
        id: '1882',
        name: '1882: Assiniboia',
        orientation: HexOrientation.Flat,
        locations: [
            ...locations('I1', exit([4, 5], 40, 80)),
            ...locations('B2', exit([0, 5], 30, 60), rivers([0, 40])),
            ...locations('O11', exit([3], 30, 30)),
            ...locations('B12', exit([0, 1], 40, 50), rivers([0, 60])),
            ...locations('I13', exit([1, 2], 30, 40)),
            ...locations('B6', Fishing),

            ...locations('F2 H2 K5 M5 L6 M7 M9 B10 L10 H12 B4', blank),
            ...locations('K11', blank, rivers([3, 40])),
            ...locations('J2', blank, rivers([4, 20])),
            ...locations('L4', blank, rivers([2, 40])),
            ...locations('D2', blank, rivers([3, 40], [4, 20])),
            ...locations('F6', blank, rivers([3, 40], [4, 20])),
            ...locations('E3 J6', blank, rivers([3, 40], [4, 40])),
            ...locations('I3 E7', blank, rivers([0, 40], [1, 20], [5, 40])),
            ...locations('J4 H8', blank, rivers([1, 40], [2, 40], [3, 40])),
            ...locations('C5 G5', blank, rivers([0, 40])),
            ...locations('H4', blank, rivers([0, 40], [5, 20])),
            ...locations('H6', blank, rivers([0, 40], [1, 40])),
            ...locations('I7', blank, rivers([0, 20], [1, 40], [4, 40], [5, 40])),
            ...locations('K7', blank, rivers([3, 20])),
            ...locations('E9', blank, rivers([0, 40], [3, 20], [4, 40], [5, 40])),
            ...locations('I9', blank, rivers([5, 60])),
            ...locations('D10', blank, rivers([0, 60], [1, 40], [5, 40])),
            ...locations('F10 E11', blank, rivers([2, 40], [3, 60])),
            ...locations('H10', blank, rivers([0, 20])),
            ...locations('D12', blank, rivers([2, 60], [3, 60])),

            ...locations('G3 L8 G11 J12', emptyCity),
            ...locations('C3', emptyCity, rivers([0, 40], [1, 20])),
            ...locations('K3', emptyCity, rivers([0, 20], [1, 40], [3, 40], [4, 40], [5, 40])),
            ...locations('D4', emptyCity, rivers([0, 40], [1, 40], [5, 20])),
            ...locations('D6', emptyCity, rivers([0, 40], [1, 40])),
            ...locations('G7', emptyCity, rivers([3, 40], [5, 40])),
            ...locations('J8', emptyCity, rivers([2, 40])),
            ...locations('G9', emptyCity, rivers([2, 20], [3, 40])),
            ...locations('C11', emptyCity, rivers([0, 60], [5, 60])),
            ...locations('I5', emptyCity, rivers([2, 20], [3, 40], [4, 40])),

            ...locations('M3', emptyTown, {
                terrain: { cost: 40, kinds: ['mountain'] },
                ...rivers([3, 20])
            }),
            ...locations('L12', emptyTown),
            ...locations('F4', emptyTown, rivers([3, 40])),
            ...locations('K9', twoTowns),
            ...locations('I11', twoTowns, rivers([0, 40], [1, 40])),
            ...locations('F8', twoTowns, rivers([0, 40], [2, 40], [3, 40], [5, 20])),

            ...locations('L2', city('gray', [4, 5], 40, 1), rivers([4, 40])),
            ...locations('N6', city('gray', [2, 4], 30, 1)),
            ...locations('C7', track('gray', [[0, 1]]), { borders: impassable(5) }),
            ...locations('D8', city('gray', [0, 1], 30, 1), {
                borders: [{ edge: 0, kind: 'water', cost: 40 }, ...impassable(2, 4)]
            }),
            ...locations('N8', track('gray', [[3, 4]])),
            ...locations('C9', town('gray', [[0, 4]], 10), {
                borders: [{ edge: 0, kind: 'water', cost: 20 }, ...impassable(1)]
            }),
            ...locations('N10', track('gray', [[2, 4]])),
            ...locations('A11', town('gray', [[0, 1]], 10)),
            ...locations('N12', town('gray', [[2, 3]], 10)),
            ...locations('K13', city('gray', [2], 20, 1)),

            ...locations(
                'M11',
                cities(
                    'yellow',
                    [
                        { edges: [], revenue: 0, stationSlots: 1 },
                        { edges: [], revenue: 0, stationSlots: 1 }
                    ],
                    ['OO']
                )
            ),
            ...locations(
                'E5',
                cities(
                    'yellow',
                    [
                        { edges: [], revenue: 0, stationSlots: 1 },
                        { edges: [], revenue: 0, stationSlots: 1 }
                    ],
                    ['OO']
                ),
                rivers([2, 20], [3, 40], [4, 40])
            ),
            ...locations(
                QLHome,
                cities(
                    'yellow',
                    [
                        { edges: [1], revenue: 40, stationSlots: 1 },
                        { edges: [4], revenue: 40, stationSlots: 1 }
                    ],
                    ['R']
                ),
                rivers([2, 60], [3, 20], [4, 40])
            ),
            ...locations('F12', track('yellow', [[1, 3]]))
        ]
    },
    { neutralStations: NeutralStations1882 }
)

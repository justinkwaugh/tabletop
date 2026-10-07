import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createStagedTileRevenue,
    createTrackTileFace as track,
    createCityTileFace as city,
    createSeparateCitiesTileFace as cities,
    createOffboardTileFace as offboard,
    type MapLocation,
    type TileEdge,
    type StationReservation
} from '@tabletop/18xx'
import { Corporations } from './catalog.js'

const names = {
    B8: 'Holland',
    B16: 'Port Huron',
    B18: 'Sarnia',
    C5: 'Chicago Connections',
    C9: 'South Bend',
    C15: 'Detroit',
    C17: 'Windsor',
    D6: 'Chicago',
    D14: 'Toledo',
    D20: 'Erie',
    D22: 'Buffalo',
    E11: 'Fort Wayne',
    E17: 'Cleveland',
    E21: 'Salamanca',
    E23: 'Binghamton',
    F20: 'Homewood',
    G3: 'Springfield',
    G7: 'Terre Haute',
    G9: 'Indianapolis',
    G13: 'Dayton',
    G15: 'Columbus',
    G19: 'Wheeling',
    G21: 'Pittsburgh',
    H12: 'Cincinnati',
    H20: 'Cumberland',
    I1: 'St. Louis',
    I5: 'Centralia',
    I15: 'Huntington',
    I17: 'Charleston',
    J10: 'Louisville',
    K3: 'Cairo'
}
export const LandGrantLocations = ['E5', 'F6', 'G5', 'H6', 'J4']
export const PrivateTrackBlocks: Readonly<Record<string, readonly string[]>> = {
    MC: ['B10', 'B12'],
    'O&I': ['F14', 'F16']
}
const markers: Record<string, NonNullable<MapLocation['markers']>> = {}
for (const id of LandGrantLocations)
    markers[id] = [
        {
            id: 'IC',
            label: '$0 IC',
            description: 'Illinois Central land grant: free yellow tile; hexside costs still apply.'
        }
    ]
for (const [id, hexes] of Object.entries(PrivateTrackBlocks))
    for (const hex of hexes)
        markers[hex] = [
            { id, label: id, description: `${id} reserves this hex while player-owned.` }
        ]
export const MeatPackingLocations = ['I1', 'D6']
export const PortSymbols: Readonly<Record<string, number>> = { B8: 2, C5: 1, D14: 1, G19: 2, I1: 1 }
export const EastWestBonuses: Readonly<Record<string, { side: 'east' | 'west'; amount: number }>> =
    {
        B18: { side: 'east', amount: 20 },
        C17: { side: 'east', amount: 30 },
        C21: { side: 'east', amount: 30 },
        D22: { side: 'east', amount: 30 },
        E23: { side: 'east', amount: 30 },
        I17: { side: 'east', amount: 20 },
        F22: { side: 'east', amount: 20 },
        G21: { side: 'east', amount: 20 },
        H20: { side: 'east', amount: 30 },
        C5: { side: 'west', amount: 50 },
        I1: { side: 'west', amount: 20 }
    }
// Buffalo and Pittsburgh each span two hexes; their E and bonus are printed once, in the other hex.
const SecondAreaHexes = ['C21', 'F22']
for (const [id, bonus] of Object.entries(EastWestBonuses))
    if (!SecondAreaHexes.includes(id))
        markers[id] = [
            ...(markers[id] ?? []),
            {
                id: 'east-west',
                label: `+${bonus.amount}`,
                description: 'East–West bonus: count both endpoints.'
            }
        ]
for (const [id, ports] of Object.entries(PortSymbols))
    markers[id] = [
        ...(markers[id] ?? []),
        {
            id: 'ports',
            label: `Port ×${ports}`,
            description: `${ports} port symbols for Steamboat Company.`,
            count: ports
        }
    ]
for (const id of MeatPackingLocations)
    markers[id] = [
        ...(markers[id] ?? []),
        {
            id: 'meat-packing',
            label: 'Meat packing',
            description: 'Meat Packing Company may place its +$30 marker here.'
        }
    ]
const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 1,
    fixedColors: ['gray', 'red', 'blue'],
    names,
    homes: Object.fromEntries([
        ...Corporations.map((company) => [company.home, company.id]),
        ['C15', 'MS'],
        ['G9', 'BIG4']
    ]),
    markers
})
const blank = track('white', [])
const border = (edge: TileEdge, kind: 'water' | 'mountain', cost: number) => ({
    borders: [{ edge, kind, cost }]
})
const terrain = (cost: number) => ({ terrain: { cost, kinds: ['mountain'] } })
const endpoint = (edges: readonly TileEdge[], early: number, late: number) =>
    offboard(
        edges,
        createStagedTileRevenue([
            ['yellow', early],
            ['brown', late]
        ])
    )
const withAreaLabel = (location: MapLocation): MapLocation => {
    const bonus = EastWestBonuses[location.id]
    if (!bonus || SecondAreaHexes.includes(location.id)) return location
    const label = bonus.side === 'east' ? 'E' : 'W'
    return { ...location, preprintedTile: { ...location.preprintedTile, labels: [label] } }
}
export const EighteenFortySixMap = new RailwayMap({
    id: '1846',
    name: '1846: The Race to the Midwest',
    orientation: HexOrientation.Pointy,
    locations: [
        ...locations(
            'B14 C11 C13 D8 D10 D12 E7 E9 E13 E15 F4 F8 F10 F12 G11 H2 H4 H8 H10 I3 I7 I9 J8 D18 B10 B12 F14 F16 E5 F6 G5 H6',
            blank
        ),
        ...locations('E19', blank, border(5, 'mountain', 40)),
        ...locations('J4', blank, border(4, 'water', 40)),
        ...locations('J6', blank, border(1, 'water', 40)),
        ...locations('I11', blank, border(3, 'water', 40)),
        ...locations('C9 E11 G3 G7 G9 G15 G13', city('white', [], 0, 1)),
        ...locations('B16', city('white', [], 0, 1), border(4, 'mountain', 40)),
        ...locations('D14', city('white', [], 0, 1)),
        ...locations('E17', city('white', [], 0, 1, ['Z'])),
        ...locations('H12', city('white', [], 0, 1, ['Z']), border(0, 'water', 40)),
        ...locations('F18', blank, { ...terrain(40), ...border(5, 'water', 40) }),
        ...locations('H16', blank, terrain(40)),
        ...locations('G17', blank, { ...terrain(40), ...border(4, 'water', 20) }),
        ...locations('H14', blank, terrain(60)),
        ...locations('A15 C7', track('gray', [[0, 5]])),
        ...locations('F20', city('gray', [1, 2, 4, 5], 10, 1), border(2, 'mountain', 40)),
        ...locations('I5', city('gray', [0, 1, 3, 4], 10, 2)),
        ...locations('I15', city('gray', [2, 3, 4], 20, 1)),
        ...locations('E21', city('gray', [1, 2, 4], 10, 1)),
        ...locations('K3', city('gray', [3], 20, 1)),
        ...locations('B8', endpoint([4], 40, 10)),
        ...locations('B18', endpoint([1], 30, 50), {
            ...border(1, 'mountain', 40),
            stopGroup: 'East'
        }),
        ...locations('C5', endpoint([5], 20, 40)),
        ...locations('C17', endpoint([1], 40, 60), {
            ...border(1, 'mountain', 60),
            stopGroup: 'East'
        }),
        ...locations('C21', endpoint([0], 30, 60), { stopGroup: 'East' }),
        ...locations('D22', endpoint([1], 30, 60), { stopGroup: 'East' }),
        ...locations('E23', endpoint([1], 20, 50), { stopGroup: 'East' }),
        ...locations('I17', endpoint([1], 20, 50), { stopGroup: 'East' }),
        ...locations('F22', endpoint([1], 30, 70), { stopGroup: 'East' }),
        ...locations('G21', endpoint([1, 2], 30, 70), {
            ...border(1, 'mountain', 20),
            stopGroup: 'East'
        }),
        ...locations('H20', endpoint([2], 20, 40), { stopGroup: 'East' }),
        ...locations('I1', endpoint([3, 4], 50, 70)),
        ...locations('J10', endpoint([2, 3], 50, 70)),
        ...locations('C15', city('yellow', [1, 3], 40, 2, ['Z']), {
            terrain: { cost: 40, kinds: ['water'] },
            ...border(4, 'mountain', 60)
        }),
        ...locations(
            'D6',
            cities(
                'yellow',
                ([0, 3, 4, 5] as const).map((edge) => ({
                    edges: [edge],
                    revenue: 10,
                    stationSlots: 1
                })),
                ['Chi']
            )
        ),
        ...locations('D20', city('yellow', [0, 1, 3], 10, 2)),
        ...locations('G19', city('yellow', [5], 10, 1), {
            borders: [
                { edge: 1, kind: 'water', cost: 20 },
                { edge: 2, kind: 'water', cost: 40 },
                { edge: 4, kind: 'mountain', cost: 20 }
            ]
        }),
        ...locations('D16', track('blue', []))
    ].map(withAreaLabel)
})

export const AdditionalReservations: readonly StationReservation[] = [
    { companyId: 'B&O', locationId: 'H12', nodeId: 'city' },
    { companyId: 'ERIE', locationId: 'D20', nodeId: 'city' },
    { companyId: 'IC', locationId: 'I5', nodeId: 'city' },
    { companyId: 'PRR', locationId: 'E11', nodeId: 'city' }
]

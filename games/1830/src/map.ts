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
    type MapLocation,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'

const Names: Readonly<Record<string, string>> = {
    D2: 'Lansing',
    F2: 'Chicago',
    J2: 'Gulf',
    F4: 'Toledo',
    J14: 'Washington',
    F22: 'Providence',
    E5: 'Detroit & Windsor',
    D10: 'Hamilton & Toronto',
    F6: 'Cleveland',
    E7: 'London',
    A11: 'Canadian West',
    K13: 'Deep South',
    E11: 'Dunkirk & Buffalo',
    H12: 'Altoona',
    D14: 'Rochester',
    C15: 'Kingston',
    I15: 'Baltimore',
    K15: 'Richmond',
    B16: 'Ottawa',
    F16: 'Scranton',
    H18: 'Philadelphia & Trenton',
    A19: 'Montreal',
    E19: 'Albany',
    G19: 'New York & Newark',
    I19: 'Atlantic City',
    F24: 'Mansfield',
    B20: 'Burlington',
    E23: 'Boston',
    B24: 'Maritime Provinces',
    D4: 'Flint',
    F10: 'Erie',
    G7: 'Akron & Canton',
    G17: 'Reading & Allentown',
    F20: 'New Haven & Hartford',
    H4: 'Columbus',
    B10: 'Barrie',
    H10: 'Pittsburgh',
    H16: 'Lancaster'
}

const Homes: Readonly<Record<string, string | CityReservation>> = {
    H12: 'PRR',
    E19: 'NYC',
    A19: 'CPR',
    I15: 'BO',
    E11: 'ERIE',
    F6: 'CO',
    G19: { companyId: 'NYNH', nodeId: 'city-0' },
    E23: 'BM'
}

const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = {
    G15: [blocker('SV', 'Schuylkill Valley')],
    B20: [blocker('CS', 'Champlain & St. Lawrence')],
    F16: [blocker('DH', 'Delaware & Hudson')],
    D18: [blocker('MH', 'Mohawk & Hudson')],
    H18: [blocker('CA', 'Camden & Amboy')],
    I13: [blocker('BOP', 'Baltimore & Ohio')],
    I15: [blocker('BOP', 'Baltimore & Ohio')]
}

function blocker(id: string, name: string) {
    return {
        id: `blocks-${id}`,
        label: id === 'BOP' ? 'B&O' : id,
        description: `No track while ${name} is player-owned.`
    }
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 1,
    fixedColors: ['gray', 'red'],
    names: Names,
    homes: Homes,
    markers: Markers
})

const water = { terrain: { cost: 80, kinds: ['water'] } }
const mountain = { terrain: { cost: 120, kinds: ['mountain'] } }
const blank = track('white', [])
// Canada's two hexes are one stop. The reference tags only I1 of the Gulf, so the Gulf's two
// hexes stay separate stops.
const canada = { stopGroup: 'Canada' }

// Altoona's city sits beside the through track that bypasses it.
const Altoona: TileFace = {
    color: 'gray',
    nodes: [{ id: 'city', kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 10 } }],
    paths: [
        {
            id: 'edge-1',
            endpoints: [
                { kind: 'edge', edge: 1 },
                { kind: 'node', nodeId: 'city' }
            ]
        },
        {
            id: 'edge-4',
            endpoints: [
                { kind: 'edge', edge: 4 },
                { kind: 'node', nodeId: 'city' }
            ]
        },
        {
            id: 'bypass',
            endpoints: [
                { kind: 'edge', edge: 1 },
                { kind: 'edge', edge: 4 }
            ]
        }
    ],
    labels: []
}

const separateCities = (
    edges: readonly (readonly TileEdge[])[],
    amount: number,
    labels: string[]
) =>
    cities(
        'yellow',
        edges.map((cityEdges) => ({ edges: cityEdges, revenue: amount, stationSlots: 1 })),
        labels
    )

export const EighteenThirtyMap = new RailwayMap({
    id: '1830',
    name: '1830',
    orientation: HexOrientation.Pointy,
    locations: [
        ...locations(
            'F2',
            offboard(
                [3, 4, 5],
                revenue([
                    ['yellow', 40],
                    ['brown', 70]
                ])
            )
        ),
        ...locations(
            'I1',
            offboard(
                [4],
                revenue([
                    ['yellow', 30],
                    ['brown', 60]
                ])
            )
        ),
        ...locations(
            'J2',
            offboard(
                [3, 4],
                revenue([
                    ['yellow', 30],
                    ['brown', 60]
                ])
            )
        ),
        ...locations(
            'A9',
            offboard(
                [5],
                revenue([
                    ['yellow', 30],
                    ['brown', 50]
                ])
            ),
            canada
        ),
        ...locations(
            'A11',
            offboard(
                [5, 0],
                revenue([
                    ['yellow', 30],
                    ['brown', 50]
                ])
            ),
            canada
        ),
        ...locations(
            'K13',
            offboard(
                [2, 3],
                revenue([
                    ['yellow', 30],
                    ['brown', 40]
                ])
            )
        ),
        ...locations(
            'B24',
            offboard(
                [1, 0],
                revenue([
                    ['yellow', 20],
                    ['brown', 30]
                ])
            )
        ),
        ...locations('D2', city('gray', [5, 4], 20, 1)),
        ...locations('F6', city('gray', [5, 0], 30, 1)),
        ...locations('E9', track('gray', [[2, 3]])),
        ...locations('H12', Altoona),
        ...locations('D14', city('gray', [1, 4, 0], 20, 1)),
        ...locations('C15', town('gray', [[1, 3]], 10)),
        ...locations('K15', city('gray', [2], 20, 1)),
        ...locations('A17', track('gray', [[0, 5]])),
        ...locations('A19', city('gray', [5, 0], 40, 1)),
        ...locations('I19 F24', town('gray', [[1, 2]], 10)),
        ...locations('D24', track('gray', [[1, 0]])),
        ...locations('F4 J14 F22', city('white', [], 0, 1), water),
        ...locations('E7', town('white', [[]], 0), {
            borders: [{ edge: 5, kind: 'impassable' }]
        }),
        ...locations('F8', blank, { borders: [{ edge: 2, kind: 'impassable' }] }),
        ...locations('C11', blank, { borders: [{ edge: 5, kind: 'impassable' }] }),
        ...locations('C13', blank, { borders: [{ edge: 0, kind: 'impassable' }] }),
        ...locations('D12', blank, {
            borders: [
                { edge: 2, kind: 'impassable' },
                { edge: 3, kind: 'impassable' }
            ]
        }),
        ...locations('B16', city('white', [], 0, 1), {
            borders: [{ edge: 5, kind: 'impassable' }]
        }),
        ...locations('C17', blank, {
            ...mountain,
            borders: [{ edge: 2, kind: 'impassable' }]
        }),
        ...locations('B20 D4 F10', town('white', [[]], 0)),
        ...locations(
            'I13 D18 B12 B14 B22 C7 C9 C23 D8 D16 D20 E3 E13 E15 F12 F14 F18 G3 G5 G9 G11 H2 H6 H8 H14 I3 I5 I7 I9 J4 J6 J8',
            blank
        ),
        ...locations('G15 C21 D22 E17 E21 G13 I11 J10 J12', blank, mountain),
        ...locations('E19 H4 B10 H10 H16', city('white', [], 0, 1)),
        ...locations('F16', city('white', [], 0, 1), mountain),
        ...locations('G7 G17 F20', town('white', [[], []], 0)),
        ...locations('D6 I17 B18 C19', blank, water),
        ...locations('E5 D10', separateCities([[], []], 0, ['OO']), water),
        ...locations('E11 H18', separateCities([[], []], 0, ['OO'])),
        ...locations('I15', city('yellow', [4, 0], 30, 1, ['B'])),
        ...locations('G19', separateCities([[3], [0]], 40, ['NY']), water),
        ...locations('E23', city('yellow', [3, 5], 30, 1, ['B']))
    ]
})

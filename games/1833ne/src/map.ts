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
    A6: 'Ogdensburg RR',
    A12: 'D&H RR',
    A20: 'Albany',
    A24: 'Hudson Valley',
    A28: 'New York',
    B3: 'Montreal',
    B11: 'Westport',
    B17: 'Troy',
    B27: 'Bridgeport',
    C4: 'St. Jean',
    C8: 'St. Albans/Burlington',
    C12: 'Rutland',
    C24: 'Hartford',
    C26: 'New Haven',
    D19: 'Greenfield',
    D21: 'Springfield',
    E20: 'Fitchburg',
    E22: 'Worcester',
    E26: 'Norwich',
    F1: 'Eastern Townships',
    F3: 'Richmond',
    F5: 'Sherbrooke',
    F15: 'Concord',
    F17: 'Manchester',
    F19: 'Nashua',
    F21: 'Concord',
    F23: 'Framingham',
    F25: 'Providence',
    F27: 'Kingston',
    G2: 'Eastern Townships',
    G20: 'Lowell',
    G22: 'Boston',
    G24: 'Mansfield',
    G26: 'Fall River',
    H17: 'Portsmouth',
    H19: 'Newburyport',
    H21: 'Salem',
    H23: 'Quincy',
    H25: 'New Bedford & Plymouth',
    I10: 'Bethel',
    I14: 'Portland',
    I26: 'Hyannis',
    J11: 'Lewiston'
}

/** The locations route bonuses name. */
export const Places = {
    boston: 'G22',
    montreal: 'B3',
    portland: 'I14',
    ogdensburg: 'A6',
    delawareHudson: 'A12',
    newYork: 'A28',
    albanyTroy: ['A20', 'B17'],
    portCities: ['C26', 'E26'],
    sherbrooke: 'F5',
    worcester: 'E22'
} as const

const Homes: Readonly<Record<string, string | CityReservation | readonly CityReservation[]>> = {
    B3: { companyId: 'StL&A', nodeId: 'city-1' },
    C8: 'CV',
    C12: 'RR',
    C24: 'HR',
    E20: 'FRR',
    F25: 'B&P',
    G22: [
        { companyId: 'B&W', nodeId: 'city-0' },
        { companyId: 'B&L', nodeId: 'city-1' }
    ],
    I14: 'A&StL'
}

/** The hexes privates keep free of track while players own them (§6.46). */
export const PrivateBlocks: Readonly<Record<string, readonly string[]>> = {
    P1: ['H23'],
    P2: ['G20'],
    P3: ['C4', 'C6']
}

/** The hexes only one corporation may build in during the game's first operating round. */
export const FirstRoundReservedHexes: Readonly<Record<string, string>> = {
    F23: 'B&W',
    G24: 'B&P'
}

const Markers: Record<string, NonNullable<MapLocation['markers']>> = {}
for (const [privateId, locationIds] of Object.entries(PrivateBlocks))
    for (const locationId of locationIds)
        Markers[locationId] = [
            {
                id: `blocks-${privateId}`,
                label: privateId,
                privateCompanyId: privateId,
                description: `No track until a corporation buys ${privateId}.`
            }
        ]
for (const [locationId, companyId] of Object.entries(FirstRoundReservedHexes))
    Markers[locationId] = [
        {
            id: 'first-round',
            label: `OR1: ${companyId}`,
            description: `Only the ${companyId} may lay a tile here in the first operating round.`
        }
    ]

/** The five ferries' cities and values (setup, p. 3). */
export const FerryPorts: Readonly<Record<string, { name: string; value: number }>> = {
    C26: { name: 'New Haven', value: 20 },
    E26: { name: 'Allyn’s Point', value: 20 },
    F27: { name: 'Stonington', value: 20 },
    F25: { name: 'Providence', value: 10 },
    G26: { name: 'Fall River', value: 20 }
}
for (const [locationId, ferry] of Object.entries(FerryPorts))
    Markers[locationId] = [
        ...(Markers[locationId] ?? []),
        {
            id: 'ferry',
            label: `Ferry ${ferry.value}`,
            description: `The ${ferry.name} ferry: $40 to a corporation connected here and on to Boston; worth $${ferry.value} on its routes.`
        }
    ]

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 0,
    fixedColors: ['gray', 'red', 'blue'],
    names: Names,
    homes: Homes,
    markers: Markers
})

type TileBorder = NonNullable<MapLocation['borders']>[number]
const blank = track('white', [])
const water = (cost: number) => ({ terrain: { cost, kinds: ['water'] } })
const mountain = (cost: number) => ({ terrain: { cost, kinds: ['mountain'] } })
const border = (edge: TileEdge, kind: TileBorder['kind'], cost?: number): TileBorder => ({
    edge,
    kind,
    ...(cost ? { cost } : {})
})
const borders = (...list: TileBorder[]) => ({ borders: list })
const emptyTown = town('white', [[]], 0)
const emptyCity = city('white', [], 0, 1)
const upgradeCost = (face: TileFace, cost: number): TileFace => ({ ...face, upgradeCost: cost })

/** Off-board values for phases I–II, III–IV and V. */
const phased = (early: number, middle: number, late: number) =>
    revenue([
        ['yellow', early],
        ['brown', middle],
        ['gray', late]
    ])

// Boston's and Portland's triangles end the track in their hex and are worth their city.
const Boston: TileFace = {
    color: 'yellow',
    labels: ['B'],
    nodes: [
        { id: 'city-0', kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 30 } },
        { id: 'city-1', kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 30 } },
        { id: 'terminal', kind: 'offboard', revenue: { kind: 'fixed', amount: 30 } }
    ],
    paths: [
        {
            id: 'city-0-edge-1',
            endpoints: [
                { kind: 'edge', edge: 1 },
                { kind: 'node', nodeId: 'city-0' }
            ]
        },
        {
            id: 'city-1-edge-3',
            endpoints: [
                { kind: 'edge', edge: 3 },
                { kind: 'node', nodeId: 'city-1' }
            ]
        },
        {
            id: 'terminal-edge-0',
            endpoints: [
                { kind: 'edge', edge: 0 },
                { kind: 'node', nodeId: 'terminal' }
            ]
        }
    ]
}
const Portland: TileFace = {
    color: 'yellow',
    labels: ['Po'],
    nodes: [
        { id: 'city-0', kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 30 } },
        { id: 'terminal-0', kind: 'offboard', revenue: { kind: 'fixed', amount: 30 } },
        { id: 'terminal-1', kind: 'offboard', revenue: { kind: 'fixed', amount: 30 } }
    ],
    paths: [
        {
            id: 'city-0-edge-3',
            endpoints: [
                { kind: 'edge', edge: 3 },
                { kind: 'node', nodeId: 'city-0' }
            ]
        },
        {
            id: 'terminal-0-edge-1',
            endpoints: [
                { kind: 'edge', edge: 1 },
                { kind: 'node', nodeId: 'terminal-0' }
            ]
        },
        {
            id: 'terminal-1-edge-2',
            endpoints: [
                { kind: 'edge', edge: 2 },
                { kind: 'node', nodeId: 'terminal-1' }
            ]
        }
    ]
}
const Richmond: TileFace = {
    color: 'gray',
    labels: [],
    nodes: [{ id: 'town', kind: 'town', revenue: { kind: 'fixed', amount: 10 } }],
    paths: [
        {
            id: 'edge-0-edge-2',
            endpoints: [
                { kind: 'edge', edge: 0 },
                { kind: 'edge', edge: 2 }
            ]
        },
        {
            id: 'town-edge-2',
            endpoints: [
                { kind: 'edge', edge: 2 },
                { kind: 'node', nodeId: 'town' }
            ]
        },
        {
            id: 'town-edge-3',
            endpoints: [
                { kind: 'edge', edge: 3 },
                { kind: 'node', nodeId: 'town' }
            ]
        }
    ]
}
// Cape Cod's tip takes track to the sea without a stop.
const CapeCod: TileFace = {
    color: 'blue',
    labels: [],
    nodes: [{ id: 'junction', kind: 'junction' }],
    paths: [
        {
            id: 'edge-1',
            endpoints: [
                { kind: 'edge', edge: 1 },
                { kind: 'node', nodeId: 'junction' }
            ]
        }
    ]
}

export const Map1833NE = new RailwayMap({
    id: '1833ne',
    name: '1833NE',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations('A6', offboard([5], phased(10, 30, 10))),
        // The D&H's value counts only with Montreal, as a bonus for that pair.
        ...locations('A12', offboard([4], phased(0, 0, 0))),
        ...locations('A18', track('red', [])),
        ...locations('A20', offboard([5], phased(40, 30, 0)), { stopGroup: 'Albany/Troy' }),
        ...locations('A24', offboard([5], phased(10, 40, 30))),
        ...locations('A28', offboard([4], phased(0, 20, 90))),
        ...locations('B17', offboard([0, 3, 5], phased(30, 50, 40)), {
            stopGroup: 'Albany/Troy'
        }),
        ...locations('F1', offboard([0], phased(30, 20, 0)), {
            stopGroup: 'Eastern Townships'
        }),
        ...locations('G2', offboard([0], phased(30, 20, 0)), {
            stopGroup: 'Eastern Townships'
        }),
        ...locations('J11', offboard([2], phased(20, 30, 20))),
        ...locations('C28', { ...offboard([2, 3], revenue([['yellow', 0]])), color: 'blue' }),
        ...locations('E28', { ...offboard([3], revenue([['yellow', 0]])), color: 'blue' }),
        ...locations('J25', CapeCod),

        ...locations(
            'B7',
            track('gray', [
                [0, 2],
                [0, 3],
                [2, 5]
            ])
        ),
        ...locations('F3', Richmond),
        ...locations('G4', track('gray', [[1, 3]])),
        ...locations(
            'H25',
            cities('gray', [
                { edges: [3], revenue: 20, stationSlots: 1 },
                { edges: [1, 5], revenue: 30, stationSlots: 1 }
            ])
        ),

        ...locations(
            'B3',
            upgradeCost(
                cities(
                    'yellow',
                    [
                        { edges: [5], revenue: 30, stationSlots: 1 },
                        { edges: [4], revenue: 30, stationSlots: 1 }
                    ],
                    ['Mo']
                ),
                40
            )
        ),
        ...locations('B11', upgradeCost({ ...town('yellow', [[1, 3]], 20), labels: ['We'] }, 40), {
            ...borders(border(4, 'impassable'))
        }),
        ...locations('C24', city('yellow', [0, 4], 20, 1)),
        ...locations('E20', city('yellow', [2, 5], 20, 1)),
        ...locations('F17', city('yellow', [0, 3], 30, 1, ['Ma']), {
            ...borders(border(2, 'water', 40))
        }),
        ...locations('F25', upgradeCost(city('yellow', [0, 4], 20, 1, ['Pr']), 40)),
        ...locations('G22', Boston),
        ...locations('I14', Portland),

        ...locations('B5 B15 B23 B25 C6 D3 D5 D9 E2 E4 E8 E10 H15 I12', blank),
        ...locations('D23 D25', blank, water(60)),
        ...locations('C2 E6 E12 F7 G14 G18 H13', blank, water(40)),
        ...locations('D27', blank, water(100)),
        ...locations('B19 C16', blank, mountain(120)),
        ...locations('F11', blank, mountain(100)),
        ...locations('C18 D7 D11 H11', blank, mountain(80)),
        ...locations('B21 F13 G16', blank, mountain(60)),
        ...locations('B27 C4 F21 G24 I10', emptyTown),
        ...locations('I26', { ...emptyTown, labels: ['Hy'] }),
        ...locations('D19 H19', emptyTown, water(40)),
        ...locations('C12 C26 E22 F19 G20 H17', emptyCity),
        ...locations('F5', { ...emptyCity, labels: ['Sh'] }),
        ...locations('B9', blank, borders(border(4, 'impassable'), border(5, 'water', 20))),
        ...locations('C8', emptyCity, borders(border(1, 'impassable'))),
        ...locations('C10', blank, borders(border(1, 'impassable'), border(2, 'water', 20))),
        ...locations('C14', blank, borders(border(4, 'mountain', 60), border(5, 'mountain', 60))),
        ...locations('C20', blank, { ...mountain(60), ...borders(border(5, 'water', 40)) }),
        ...locations('C22', blank, { ...mountain(60), ...borders(border(4, 'water', 40)) }),
        ...locations('D13', blank, borders(border(1, 'mountain', 60), border(5, 'impassable'))),
        ...locations('D15', blank, borders(border(2, 'mountain', 60), border(4, 'impassable'))),
        ...locations('D17', blank, borders(border(5, 'water', 60))),
        ...locations('D21', emptyCity, borders(border(1, 'water', 40), border(2, 'water', 40))),
        ...locations('E14', blank, borders(border(1, 'impassable'), border(2, 'impassable'))),
        ...locations('E16', blank, {
            ...water(60),
            ...borders(border(4, 'water', 40), border(5, 'water', 40))
        }),
        ...locations('E18', blank, borders(border(2, 'water', 60))),
        ...locations('E24', blank, borders(border(4, 'mountain', 20))),
        ...locations('E26', emptyCity, borders(border(5, 'water', 40))),
        ...locations('F9', blank, { ...water(40), ...borders(border(5, 'mountain', 60)) }),
        ...locations('F15', emptyTown, borders(border(1, 'water', 40))),
        ...locations('F23', emptyTown, borders(border(1, 'mountain', 20))),
        ...locations('F27', emptyTown, borders(border(2, 'water', 40), border(4, 'impassable'))),
        ...locations('G8', blank, borders(border(5, 'mountain', 60))),
        ...locations('G10', blank, borders(border(0, 'mountain', 40), border(2, 'mountain', 60))),
        ...locations('G12', blank, { ...mountain(40), ...borders(border(3, 'mountain', 40)) }),
        ...locations('G26', emptyTown, borders(border(1, 'impassable'))),
        ...locations('H9', blank, borders(border(2, 'mountain', 60))),
        ...locations('H21', emptyTown, borders(border(0, 'impassable'))),
        ...locations('H23', emptyTown, borders(border(3, 'impassable')))
    ]
})

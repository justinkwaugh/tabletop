import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createStagedTileRevenue as revenue,
    createTrackTileFace as track,
    createTownTileFace as town,
    createCityTileFace as city,
    createSeparateCitiesTileFace as cities,
    createJunctionTileFace as junction,
    createOffboardTileFace as offboard
} from '@tabletop/18xx'

const Names: Readonly<Record<string, string>> = {
    A20: 'Montréal',
    A28: 'Maritime Provinces',
    B5: 'Lansing',
    B13: 'Toronto',
    B17: 'Rochester',
    C8: 'Detroit',
    C14: 'Buffalo',
    C22: 'Albany',
    C26: 'Boston',
    D1: 'Chicago',
    D7: 'Toledo',
    D9: 'Cleveland',
    D19: 'Scranton',
    E22: 'New York',
    F3: 'Indianapolis',
    F13: 'Pittsburgh',
    F19: 'Philadelphia',
    G6: 'Cincinnati',
    G18: 'Baltimore',
    H1: 'St. Louis',
    H3: 'Louisville',
    H9: 'Charleston',
    I12: 'Blacksburg',
    I16: 'Richmond',
    J7: 'Atlanta',
    J15: 'Raleigh-Durham'
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 0,
    fixedColors: ['gray', 'red', 'blue'],
    names: Names,
    homes: {},
    markers: {}
})

const mountain = { terrain: { cost: 15, kinds: ['mountain'] } }
const water = { terrain: { cost: 10, kinds: ['water'] } }
const lake = { terrain: { cost: 20, kinds: ['lake'] } }
const blank = track('white', [])
const minorOffboard = revenue([
    ['yellow', 20],
    ['green', 30],
    ['brown', 50],
    ['gray', 60]
])
const majorOffboard = revenue([
    ['yellow', 30],
    ['green', 50],
    ['brown', 60],
    ['gray', 80]
])

export const EighteenSeventeenMap = new RailwayMap({
    id: '1817',
    name: '1817',
    orientation: HexOrientation.Pointy,
    locations: [
        ...locations('A20', offboard([5, 0], minorOffboard)),
        ...locations('A28', offboard([0], minorOffboard)),
        ...locations('D1', offboard([4, 5], majorOffboard)),
        ...locations('H1', offboard([3, 4, 5], minorOffboard)),
        ...locations('J7', offboard([2, 3], majorOffboard)),
        ...locations('J15', offboard([2, 3], minorOffboard)),
        ...locations('B5 B17 C14 C22 F3 F13 F19 I16', city('white', [], 0, 1)),
        ...locations('D7', city('white', [], 0, 1), lake),
        ...locations('D19 I12', city('white', [], 0, 1), mountain),
        ...locations('G6 H3 H9', city('white', [], 0, 1), water),
        ...locations('B25 C20 C24 E16 E18 F15 G12 G14 H11 H13 H15 I8 I10', blank, mountain),
        ...locations('D13 E12 F11 G4 G10 H7', blank, water),
        ...locations('B9 B27 D25 D27 G20 H17', blank, lake),
        ...locations(
            'B3 B7 B11 B15 B19 B21 B23 C4 C6 C16 C18 D3 D5 D15 D17 D21 D23 E2 E4 E6 E8 E10 E14 E20 F5 F7 F9 F17 F21 G2 G8 G16 H5 I2 I4 I6 I14',
            blank
        ),
        ...locations('C10', blank, { borders: [{ edge: 5, kind: 'impassable' }] }),
        ...locations('D11', blank, { borders: [{ edge: 2, kind: 'impassable' }] }),
        ...locations(
            'B13',
            town(
                'gray',
                [[1, 4, 5]],
                revenue([
                    ['yellow', 20],
                    ['green', 30],
                    ['brown', 40]
                ])
            )
        ),
        ...locations(
            'D9',
            city(
                'gray',
                [5, 0],
                revenue([
                    ['yellow', 30],
                    ['green', 40],
                    ['brown', 50],
                    ['gray', 60]
                ]),
                2
            )
        ),
        ...locations('F1', junction('gray', [4, 3, 5])),
        ...locations('C8', city('yellow', [4, 0], 30, 1, ['B']), lake),
        ...locations('C26', city('yellow', [3, 5], 30, 1, ['B'])),
        ...locations('G18', city('yellow', [4, 0], 30, 1, ['B'])),
        ...locations(
            'E22',
            cities(
                'yellow',
                [
                    { edges: [0], revenue: 40, stationSlots: 1 },
                    { edges: [3], revenue: 40, stationSlots: 1 }
                ],
                ['NY']
            ),
            lake
        ),
        ...locations('C12', track('blue', []))
    ]
})

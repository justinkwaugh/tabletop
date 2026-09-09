import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createStagedTileRevenue as revenue,
    createTrackTileFace as track,
    createTownTileFace as town,
    createCityTileFace as city,
    createOffboardTileFace as offboard,
    type MapLocation
} from '@tabletop/18xx'

const Names: Readonly<Record<string, string>> = {
    A1: 'Miramichi',
    M11: 'Blooming Point',
    P10: 'Saint Peters Harbour',
    U13: 'Red Point',
    M13: 'Mount Stewart',
    S17: 'Cardigan Point',
    H6: 'England',
    H14: 'New London & Kensington',
    K15: 'Royalty Jct & York',
    M17: 'Stratford',
    M21: 'Pinette Harbour',
    R22: 'Murray Harbour',
    K19: 'Cornwall',
    K21: 'North River',
    P16: 'Cardigan Head & Lorne Valley',
    R12: 'Bear River & Selkirk',
    R16: 'Georgetown',
    R18: 'Georgetown Harbour',
    P22: 'Hopefield & Woods Islands',
    P26: 'Pictou Landing',
    L12: 'Oyster Bed Bridge',
    I13: 'Stanley Bridge',
    I17: 'Emerald Jct',
    I19: 'Kinkora',
    H20: 'Cape Traverse',
    O19: 'Iona & Eldon',
    E7: 'Northport',
    E11: 'Ellerslie & Richmond',
    C5: 'Profits Corner & Saint Louis',
    D8: 'Freeland & Portage',
    C13: 'Cape Egmont',
    A7: 'West Cape',
    T12: 'Souris',
    T14: 'Souris Harbour',
    R20: 'Beach Point',
    N20: 'Belfast',
    J14: 'Hunter River',
    J20: 'Eliot River',
    O15: 'Peakes',
    N14: 'Pisquid & Scotchfort',
    G17: 'Borden',
    D14: 'Wellington',
    D2: 'Tignish',
    V12: 'Elmira',
    V16: 'Îles de la Madeleine',
    Q17: 'Montague',
    Q15: 'Cardigan',
    Q21: 'Murray River',
    F14: 'Summerside',
    L16: 'Charlottetown',
    S21: 'Port Hawkesbury',
    D6: 'Alberton',
    F20: 'Cape Tormentine',
    G11: 'Malpeque Shipyard',
    B8: "O'Leary"
}

const Homes: Readonly<Record<string, string>> = {
    T12: 'So',
    D6: 'A',
    M13: 'MS',
    Q21: 'MR',
    F14: 'S',
    R16: 'Gt',
    L16: 'C'
}

const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = {
    N18: [
        {
            id: 'vernon-river-bridge',
            label: 'VR',
            description:
                'Construction requires the Vernon River Bridge owner’s consent until that private closes.'
        }
    ],
    G11: [
        {
            id: 'shipyard',
            label: 'Shipyard',
            description: 'Counts as a city for routes; station tokens cannot be placed here.'
        }
    ]
}

const greenX = { upgradeLabels: [{ color: 'green', label: 'X' }] }
const water60 = { terrain: { cost: 60, kinds: ['water'] } }

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 1,
    fixedColors: ['gray', 'blue', 'red'],
    names: Names,
    homes: Homes,
    markers: Markers
})

export const TheOldPrinceMap = new RailwayMap({
    id: 'the-old-prince:prototype',
    name: 'The Old Prince 1871',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations(
            'B4 C3 B6 D4 E9 H12 H18 I15 J12 J18 K13 K17 L14 N12 O11 O13 O17 O21 P20 Q11 Q13 Q19 R14 S11 S13 N18 D12 C7 P18 G15 E15',
            track('white', [])
        ),
        ...locations('U13 L12 J20 Q17 Q15', town('white', [[]], 0)),
        ...locations('M13 Q21 D6', city('white', [], 0, 1), greenX),
        ...locations('H14 K15 P16 P22 O19 E11 C5', town('white', [[], []], 0)),
        ...locations('N16 J16 H16 P14', track('white', []), {
            terrain: { cost: 80, kinds: ['mountain'] }
        }),
        ...locations('K19 N20 J14', city('white', [], 0, 1)),
        ...locations('R12 N14', town('white', [[], []], 0), water60),
        ...locations('R16', city('white', [], 0, 1), { ...water60, ...greenX }),
        ...locations('I13', town('white', [[]], 0), water60),
        ...locations('C9 D10 E13 F10', track('white', []), water60),
        ...locations('D8', town('white', [[], []], 0), { terrain: { cost: 80, kinds: ['water'] } }),
        ...locations('T12', city('white', [3], 20, 1), { ...water60, ...greenX }),
        ...locations('G13 F12', track('white', []), { terrain: { cost: 120, kinds: ['water'] } }),
        ...locations('G17', city('white', [], 0, 1), water60),
        ...locations('V12', city('white', [], 0, 1), {
            upgradeLabels: [{ color: 'green', label: 'T' }]
        }),
        ...locations('O15', city('yellow', [0, 2, 4], 30, 1)),
        ...locations('D14', city('yellow', [5, 3], 20, 1)),
        ...locations('D2', city('yellow', [0, 1], 20, 1, ['T'])),
        ...locations('F14', city('yellow', [5, 1], 20, 1, ['X'])),
        ...locations('L16', city('yellow', [1, 5], 20, 1, ['X']), {
            upgradeLabels: [{ color: 'gray', label: 'CX' }]
        }),
        ...locations(
            'M15',
            track('green', [
                [2, 3],
                [1, 5]
            ])
        ),
        ...locations('P12', city('green', [0, 2, 3, 4], 30, 2)),
        ...locations('B2 U15', track('blue', [[0, 2]])),
        ...locations('U17', track('blue', [[3, 4]])),
        ...locations('H8 P24', track('blue', [[1, 3]])),
        ...locations('H10', track('blue', [[1, 2]])),
        ...locations('F18', track('blue', [[0, 4]])),
        ...locations('O25 G9', track('blue', [[4, 5]])),
        ...locations('M11 C13 A7', town('gray', [[5]], 20)),
        ...locations('P10', town('gray', [[0]], 20)),
        ...locations('S17 R22 E7', town('gray', [[2]], 10)),
        ...locations('H20', town('gray', [[4]], 40)),
        ...locations(
            'T10',
            track('gray', [
                [0, 1],
                [0, 5],
                [1, 5]
            ])
        ),
        ...locations('U11', track('gray', [[2, 5]])),
        ...locations('M17', town('gray', [[2, 5]], 10)),
        ...locations('M21', town('gray', [[4]], 20)),
        ...locations('K21', town('gray', [[2, 3]], 10)),
        ...locations('R18', town('gray', [[3]], 10)),
        ...locations('I17', city('gray', [0, 2, 4], 10, 2)),
        ...locations('I19', town('gray', [[1, 3]], 10)),
        ...locations('O23', track('gray', [[3, 4]])),
        ...locations('T14', town('gray', [[3, 5]], 20)),
        ...locations('R20', town('gray', [[1, 5]], 20)),
        ...locations(
            'G11',
            city(
                'gray',
                [0, 4, 5],
                revenue([
                    ['yellow', 20],
                    ['brown', 60]
                ]),
                0
            )
        ),
        ...locations('B8', town('gray', [[4, 3, 2, 5]], 20)),
        ...locations(
            'A1',
            offboard(
                [5],
                revenue([
                    ['yellow', 20],
                    ['brown', 80]
                ])
            )
        ),
        ...locations(
            'H6',
            offboard(
                [0],
                revenue([
                    ['yellow', 60],
                    ['brown', 70]
                ])
            )
        ),
        ...locations(
            'P26',
            offboard(
                [2],
                revenue([
                    ['yellow', 30],
                    ['brown', 60]
                ])
            )
        ),
        ...locations(
            'V16',
            offboard(
                [1],
                revenue([
                    ['yellow', 40],
                    ['brown', 60]
                ])
            )
        ),
        ...locations(
            'S21',
            offboard(
                [2],
                revenue([
                    ['yellow', 0],
                    ['green', 10],
                    ['brown', 60]
                ])
            )
        ),
        ...locations(
            'F20',
            offboard(
                [3],
                revenue([
                    ['yellow', 30],
                    ['brown', 80]
                ])
            )
        )
    ]
})

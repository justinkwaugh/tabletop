import { HexOrientation } from '@tabletop/common'
import {
    Industry,
    SiteKind,
    printedPointyHex as hex,
    printedPointyRow as row,
    type MapDefinition,
    type RegionDefinition
} from '../types.js'

// Read from Gameboard Version 0.63. Rows count down from the top of the map; columns are
// doubled, so a row's hexes sit on every other column.
const STATES: readonly RegionDefinition[] = [
    { id: 'ND', name: 'North Dakota', hexes: [...row(0, 2, 10), ...row(1, 1, 9)] },
    {
        id: 'SD',
        name: 'South Dakota',
        hexes: [
            ...row(2, 2, 8),
            ...row(3, 3, 9),
            ...row(4, 4, 10),
            ...row(5, 5, 9),
            ...row(6, 6, 8)
        ]
    },
    {
        id: 'NE',
        name: 'Nebraska',
        hexes: [
            ...row(7, 7, 9),
            ...row(8, 8, 10),
            ...row(9, 9, 11),
            ...row(10, 8, 10),
            ...row(11, 9, 11)
        ]
    },
    { id: 'KS', name: 'Kansas', hexes: [...row(12, 10, 12), ...row(13, 11, 13)] },
    {
        id: 'MN',
        name: 'Minnesota',
        hexes: [
            ...row(0, 12, 18),
            ...row(1, 11, 17),
            ...row(2, 10, 16),
            ...row(3, 11, 17),
            ...row(4, 12, 18),
            ...row(5, 11, 19)
        ]
    },
    {
        id: 'IA',
        name: 'Iowa',
        hexes: [
            ...row(6, 10, 20),
            ...row(7, 11, 21),
            ...row(8, 12, 22),
            ...row(9, 13, 21),
            ...row(10, 12, 20)
        ]
    },
    {
        id: 'MO',
        name: 'Missouri',
        hexes: [...row(11, 13, 19), ...row(12, 14, 20), ...row(13, 15, 17), ...row(13, 21, 21)]
    },
    {
        id: 'WI',
        name: 'Wisconsin',
        hexes: [
            ...row(1, 19, 23),
            ...row(2, 18, 26),
            ...row(3, 19, 25),
            ...row(4, 20, 26),
            ...row(5, 21, 25),
            ...row(6, 22, 26),
            ...row(7, 23, 25)
        ]
    },
    {
        id: 'IL',
        name: 'Illinois',
        hexes: [
            ...row(8, 24, 26),
            ...row(9, 23, 27),
            ...row(10, 22, 26),
            ...row(11, 21, 27),
            ...row(12, 22, 26),
            ...row(13, 23, 27)
        ]
    },
    {
        id: 'MI',
        name: 'Michigan',
        hexes: [
            ...row(0, 26, 26),
            ...row(1, 25, 33),
            ...row(2, 34, 34),
            ...row(3, 33, 35),
            ...row(4, 32, 36),
            ...row(5, 31, 33),
            ...row(6, 30, 36),
            ...row(7, 31, 39),
            ...row(8, 30, 34)
        ]
    },
    {
        id: 'IN',
        name: 'Indiana',
        hexes: [
            ...row(9, 29, 31),
            ...row(10, 28, 32),
            ...row(11, 29, 31),
            ...row(12, 28, 32),
            ...row(13, 29, 29)
        ]
    },
    {
        id: 'OH',
        name: 'Ohio',
        hexes: [
            ...row(9, 33, 39),
            ...row(10, 34, 38),
            ...row(11, 33, 39),
            ...row(12, 34, 38),
            ...row(13, 35, 35)
        ]
    }
]

export const MIDWEST_MAP: MapDefinition = {
    orientation: HexOrientation.Pointy,
    countryside: STATES.flatMap((state) => state.hexes),
    regions: STATES,
    sites: [
        { id: 'bismarck', name: 'Bismarck', kind: SiteKind.Town, hex: hex(0, 2) },
        { id: 'fargo', name: 'Fargo', kind: SiteKind.City, hex: hex(0, 10) },
        { id: 'duluth', name: 'Duluth', kind: SiteKind.City, hex: hex(0, 18) },
        { id: 'st-cloud', name: 'St. Cloud', kind: SiteKind.Town, hex: hex(2, 14) },
        { id: 'minneapolis', name: 'Minneapolis', kind: SiteKind.City, hex: hex(3, 17) },
        { id: 'wausau', name: 'Wausau', kind: SiteKind.Town, hex: hex(3, 23) },
        { id: 'rapid-city', name: 'Rapid City', kind: SiteKind.Town, hex: hex(4, 4) },
        { id: 'sioux-falls', name: 'Sioux Falls', kind: SiteKind.City, hex: hex(5, 9) },
        { id: 'rochester', name: 'Rochester', kind: SiteKind.Town, hex: hex(5, 17) },
        { id: 'traverse-city', name: 'Traverse City', kind: SiteKind.Town, hex: hex(5, 31) },
        { id: 'milwaukee', name: 'Milwaukee', kind: SiteKind.Town, hex: hex(6, 26) },
        { id: 'sioux-city', name: 'Sioux City', kind: SiteKind.Town, hex: hex(7, 11) },
        { id: 'grand-rapids', name: 'Grand Rapids', kind: SiteKind.Town, hex: hex(7, 31) },
        { id: 'detroit', name: 'Detroit', kind: SiteKind.City, hex: hex(7, 37) },
        { id: 'cedar-rapids', name: 'Cedar Rapids', kind: SiteKind.Town, hex: hex(8, 20) },
        { id: 'chicago', name: 'Chicago', kind: SiteKind.City, hex: hex(8, 26) },
        { id: 'des-moines', name: 'Des Moines', kind: SiteKind.City, hex: hex(9, 15) },
        { id: 'toledo', name: 'Toledo', kind: SiteKind.Town, hex: hex(9, 35) },
        { id: 'cleveland', name: 'Cleveland', kind: SiteKind.Town, hex: hex(9, 39) },
        { id: 'lincoln', name: 'Lincoln', kind: SiteKind.Town, hex: hex(10, 10) },
        { id: 'springfield', name: 'Springfield', kind: SiteKind.Town, hex: hex(11, 23) },
        { id: 'columbus', name: 'Columbus', kind: SiteKind.City, hex: hex(11, 37) },
        { id: 'kansas-city', name: 'Kansas City', kind: SiteKind.City, hex: hex(12, 14) },
        { id: 'columbia', name: 'Columbia', kind: SiteKind.Town, hex: hex(12, 18) },
        { id: 'indianapolis', name: 'Indianapolis', kind: SiteKind.City, hex: hex(12, 30) },
        { id: 'lawrence', name: 'Lawrence', kind: SiteKind.Town, hex: hex(13, 11) },
        { id: 'st-louis', name: 'St. Louis', kind: SiteKind.City, hex: hex(13, 23) }
    ],
    industrySites: [
        { industry: Industry.Grain, hex: hex(0, 14) },
        { industry: Industry.Steel, hex: hex(1, 1) },
        { industry: Industry.Cloth, hex: hex(1, 33) },
        { industry: Industry.Cloth, hex: hex(2, 6) },
        { industry: Industry.Brick, hex: hex(2, 20) },
        { industry: Industry.Brick, hex: hex(3, 35) },
        { industry: Industry.Steel, hex: hex(6, 14) },
        { industry: Industry.Grain, hex: hex(6, 20) },
        { industry: Industry.Grain, hex: hex(7, 7) },
        { industry: Industry.Cloth, hex: hex(10, 22) },
        { industry: Industry.Steel, hex: hex(10, 28) },
        { industry: Industry.Brick, hex: hex(13, 15) }
    ],
    demandAreas: [
        {
            id: 'texas',
            name: 'Texas',
            hex: hex(13, 19),
            industries: [Industry.Steel, Industry.Grain]
        },
        {
            id: 'atlanta',
            name: 'Atlanta',
            hex: hex(13, 31),
            industries: [Industry.Cloth, Industry.Brick]
        },
        {
            id: 'washington',
            name: 'Washington D.C.',
            hex: hex(13, 37),
            industries: [Industry.Steel, Industry.Brick]
        },
        {
            id: 'new-england',
            name: 'New England',
            hex: hex(8, 40),
            industries: [Industry.Grain, Industry.Cloth]
        }
    ],
    water: [
        ...row(0, 20, 24),
        ...row(0, 28, 32),
        ...row(2, 28, 32),
        hex(2, 36),
        ...row(3, 27, 31),
        hex(3, 37),
        ...row(4, 28, 30),
        hex(4, 38),
        ...row(5, 27, 29),
        ...row(5, 35, 37),
        hex(6, 28),
        hex(6, 38),
        ...row(7, 27, 29),
        hex(8, 28),
        ...row(8, 36, 38)
    ]
}

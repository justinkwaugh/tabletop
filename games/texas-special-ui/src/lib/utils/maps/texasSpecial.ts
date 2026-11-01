import { RailroadId } from '@tabletop/texas-special'
import type { BoardLayoutSpec } from '../boardLayout.js'

// Coordinates follow James Geist's printed map; the board's furniture stands in the column to the
// right of it.
export const TEXAS_SPECIAL_LAYOUT: BoardLayoutSpec = {
    width: 1300,
    top: 300,
    bottom: 1785,
    finalPayoff: { x: 990, y: 320 },
    legend: { x: 994, y: 472 },
    specialConnection: { x: 990, y: 654 },
    logo: { x: 1120, y: 858 },
    title: 'Texas Special',
    credit: 'Map by James Geist, used with his permission',
    automaticDevelopment: { x: 1010, y: 905 },
    rulesReminder: {
        x: 990,
        y: 1030,
        width: 261,
        notes: [
            [
                'Leave Town may replace the first',
                'development: take a cube from a',
                'developed settlement a railroad you',
                'control serves, never a natural',
                'resource. It pays you $3 at every',
                'dividend, the final payoff included.'
            ],
            [
                'No metro area is free: a second',
                'development costs $3 everywhere,',
                'and metro areas need track.'
            ],
            [
                'Declining the second development,',
                'or leaving town, develops the next',
                'metro area in the order above.'
            ]
        ]
    },
    metroGrids: {
        'kansas-city': { columns: 2, origin: { x: 310, y: 350 } },
        memphis: { columns: 2, origin: { x: 873, y: 995 } },
        dallas: { columns: 2, origin: { x: 510, y: 1215 } }
    },
    baseNames: [
        { x: 60, y: 420, railroadId: RailroadId.MKT },
        { x: 878, y: 470, railroadId: RailroadId.MP },
        { x: 470, y: 805, railroadId: RailroadId.SLSF },
        { x: 130, y: 1690, railroadId: RailroadId.SP },
        { x: 674, y: 1750, railroadId: RailroadId.GHH },
        { x: 426, y: 1294, railroadId: RailroadId.TP }
    ],
    printedLabels: {
        abilene: { x: 97, y: 1408 },
        austin: { x: 276, y: 1535 },
        'baton-rouge': { x: 842, y: 1417 },
        bishop: { x: 345, y: 944 },
        chanute: { x: 238, y: 487 },
        columbia: { x: 655, y: 430 },
        'corpus-christi': { x: 396, y: 1729 },
        deleon: { x: 397, y: 1296 },
        denton: { x: 431, y: 1020 },
        emporia: { x: 41, y: 583 },
        fayetteville: { x: 762, y: 880 },
        'fort-smith': { x: 655, y: 954 },
        'fort-worth': { x: 381, y: 1242 },
        galveston: { x: 686, y: 1718 },
        granger: { x: 387, y: 1521 },
        greenville: { x: 534, y: 1114 },
        hillsboro: { x: 601, y: 1392 },
        'hot-springs': { x: 534, y: 958 },
        houston: { x: 654, y: 1520 },
        'jefferson-city': { x: 740, y: 552 },
        joplin: { x: 510, y: 666 },
        'junction-city': { x: 37, y: 442 },
        'little-rock': { x: 767, y: 984 },
        mineola: { x: 671, y: 1287 },
        moberly: { x: 586, y: 357 },
        muskogee: { x: 365, y: 828 },
        'new-orleans': { x: 916, y: 1520 },
        'oklahoma-city': { x: 48, y: 924 },
        osage: { x: 135, y: 795 },
        parsons: { x: 333, y: 626 },
        'poplar-bluff': { x: 697, y: 676 },
        rotan: { x: 144, y: 1282 },
        'san-antonio': { x: 148, y: 1653 },
        sedalia: { x: 451, y: 404 },
        sherman: { x: 379, y: 1108 },
        shreveport: { x: 812, y: 1254 },
        springfield: { x: 641, y: 823 },
        'st-louis': { x: 868, y: 440 },
        stamford: { x: 263, y: 1332 },
        texarkana: { x: 778, y: 1161 },
        topeka: { x: 163, y: 395 },
        tulsa: { x: 266, y: 830 },
        waco: { x: 517, y: 1460 },
        wichita: { x: 87, y: 679 },
        'wichita-falls': { x: 142, y: 1081 }
    },
    regions: []
}

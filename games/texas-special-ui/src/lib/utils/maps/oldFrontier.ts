import { RailroadId } from '@tabletop/texas-special'
import type { BoardLayoutSpec } from '../boardLayout.js'

// Frontier Railroads' layout, with the rules reminder in the corner below the West Frontier.
export const OLD_FRONTIER_LAYOUT: BoardLayoutSpec = {
    width: 1584,
    top: 128,
    bottom: 1272,
    legend: { x: 1326, y: 760 },
    finalPayoff: { x: 1252, y: 950 },
    logo: { x: 1092, y: 214 },
    title: 'Old Frontier Railroads',
    credit: '',
    rulesReminder: {
        x: 40,
        y: 990,
        width: 656,
        notes: [
            ['Eight rounds: the final payoff takes the place of dividend 8.'],
            [
                'Each railroad’s treasury starts with a die roll, $1–6; the Yellow’s is doubled.',
                'Special dividends round up, and a railroad’s first link into The Center pays one.'
            ],
            [
                'Links across a dashed border cannot be built until its dividend has been paid.',
                'An arrowed link is built only in the direction of its arrow.'
            ],
            [
                'Round 4, War: one link a build, for $7; no double links or connections, and the Yellow builds nothing.',
                'Develop up to three settlements, the first two free.'
            ],
            [
                'Round 5, Recovery: every dividend and special dividend pays income ÷ 10, rounded down.'
            ],
            [
                'The Yellow also opens when The Center’s income reaches $6.',
                'Until its track meets another railroad’s it pays double to build; that first meeting pays it a',
                'special dividend, unless another railroad already reaches The Center.'
            ]
        ]
    },
    closedBorders: [
        {
            opensAfterDividend: 1,
            points: [
                { x: 647, y: 336 },
                { x: 586.5, y: 335.5 },
                { x: 538, y: 313.5 },
                { x: 467, y: 305.5 },
                { x: 451, y: 287 },
                { x: 421.5, y: 259.5 },
                { x: 369.5, y: 239 },
                { x: 356, y: 250.5 }
            ],
            label: { x: 356.5, y: 238 }
        },
        {
            opensAfterDividend: 2,
            points: [
                { x: 1158.5, y: 737.5 },
                { x: 1113, y: 731.5 },
                { x: 1016, y: 718.5 },
                { x: 961.5, y: 711 },
                { x: 939.5, y: 710.5 },
                { x: 929, y: 709.5 },
                { x: 915.5, y: 710 },
                { x: 887, y: 710 },
                { x: 819, y: 696 },
                { x: 787.5, y: 681.5 },
                { x: 759, y: 650 },
                { x: 749.5, y: 613 },
                { x: 738.5, y: 579.5 },
                { x: 728, y: 539 },
                { x: 718, y: 504 },
                { x: 691.5, y: 465.5 },
                { x: 660, y: 417 },
                { x: 644, y: 383 },
                { x: 647, y: 336 }
            ],
            label: { x: 1086, y: 714, rotate: 6 }
        },
        {
            opensAfterDividend: 3,
            points: [
                { x: 1158.5, y: 736 },
                { x: 1149.5, y: 824.5 },
                { x: 1146.5, y: 840.5 },
                { x: 1135.5, y: 858 },
                { x: 1123.5, y: 872 },
                { x: 1106, y: 881 },
                { x: 1080, y: 898.5 },
                { x: 1049, y: 927 },
                { x: 923, y: 978 },
                { x: 849.5, y: 989.5 },
                { x: 809.5, y: 993 },
                { x: 774, y: 1010 },
                { x: 763, y: 1030.5 },
                { x: 762, y: 1041 }
            ],
            label: { x: 762, y: 1029 }
        }
    ],
    metroGrids: {
        center: { columns: 3, origin: { x: 624.5, y: 685.5 } },
        junction: { columns: 2, origin: { x: 1245, y: 465 } }
    },
    baseNames: [
        { x: 1485, y: 326, railroadId: RailroadId.Red },
        { x: 1445.5, y: 680.5, railroadId: RailroadId.Blue },
        { x: 1307, y: 178, railroadId: RailroadId.Green },
        { x: 717.5, y: 167.5, railroadId: RailroadId.Brown },
        { x: 153, y: 236.5, railroadId: RailroadId.Black }
    ],
    namedSettlements: ['center', 'junction'],
    printedLabels: {},
    regions: []
}

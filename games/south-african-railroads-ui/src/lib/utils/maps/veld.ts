import { RailroadId } from '@tabletop/south-african-railroads'
import type { BoardLayoutSpec } from '../boardLayout.js'
import { southAfricanArtwork } from './southAfricanArt.js'

// Coordinates follow the South African Railroads board.
export const VELD_LAYOUT: BoardLayoutSpec = {
    width: 1584,
    top: 128,
    bottom: 1124,
    legend: { x: 32, y: 330 },
    finalPayoff: { x: 32, y: 190 },
    logo: { x: 492, y: 1036 },
    title: 'Veld Railroads',
    credit: 'John Bohrer · Winsome Games · map redrawn by Stephan Suhar',
    rules: {
        notes: [
            ['Eight rounds: the final payoff takes the place of dividend 8.'],
            [
                'Each railroad’s treasury starts with a die roll, $1–6; the ZASM’s is doubled. Special dividends round up, and a railroad’s first link into Johannesburg pays one.'
            ],
            [
                'Links across a dashed border cannot be built until its dividend has been paid. An arrowed link is built only in the direction of its arrow.'
            ],
            [
                'Round 4, War: one link a build, for $7; no double links or connections, and the ZASM builds nothing. Develop up to three settlements, the first two free.'
            ],
            [
                'Round 5, Recovery: every dividend and special dividend pays income ÷ 10, rounded down.'
            ],
            [
                'The ZASM also opens when Johannesburg’s income reaches $6. Until its track meets another railroad’s it pays double to build; that first meeting pays it a special dividend, unless another railroad already reaches Johannesburg.'
            ]
        ]
    },
    closedBorders: [
        {
            opensAfterDividend: 1,
            points: [
                { x: 937, y: 916 },
                { x: 997.5, y: 916.5 },
                { x: 1046, y: 938.5 },
                { x: 1117, y: 946.5 },
                { x: 1133, y: 965 },
                { x: 1162.5, y: 992.5 },
                { x: 1214.5, y: 1013 },
                { x: 1228, y: 1001.5 }
            ],
            label: { x: 1227.5, y: 1014 }
        },
        {
            opensAfterDividend: 2,
            points: [
                { x: 425.5, y: 514.5 },
                { x: 471, y: 520.5 },
                { x: 568, y: 533.5 },
                { x: 622.5, y: 541 },
                { x: 644.5, y: 541.5 },
                { x: 655, y: 542.5 },
                { x: 668.5, y: 542 },
                { x: 697, y: 542 },
                { x: 765, y: 556 },
                { x: 796.5, y: 570.5 },
                { x: 825, y: 602 },
                { x: 834.5, y: 639 },
                { x: 845.5, y: 672.5 },
                { x: 856, y: 713 },
                { x: 866, y: 748 },
                { x: 892.5, y: 786.5 },
                { x: 924, y: 835 },
                { x: 940, y: 869 },
                { x: 937, y: 916 }
            ],
            label: { x: 498, y: 538, rotate: 6 }
        },
        {
            opensAfterDividend: 3,
            points: [
                { x: 425.5, y: 516 },
                { x: 434.5, y: 427.5 },
                { x: 437.5, y: 411.5 },
                { x: 448.5, y: 394 },
                { x: 460.5, y: 380 },
                { x: 478, y: 371 },
                { x: 504, y: 353.5 },
                { x: 535, y: 325 },
                { x: 661, y: 274 },
                { x: 734.5, y: 262.5 },
                { x: 774.5, y: 259 },
                { x: 810, y: 242 },
                { x: 821, y: 221.5 },
                { x: 822, y: 211 }
            ],
            label: { x: 918, y: 207 }
        }
    ],
    metroGrids: {
        johannesburg: { columns: 3, origin: { x: 878.5, y: 485.5 } },
        bloemfontein: { columns: 2, origin: { x: 285, y: 733 } }
    },
    baseNames: [
        { x: 27, y: 941, railroadId: RailroadId.CMRC },
        { x: 48.5, y: 586.5, railroadId: RailroadId.CTRD },
        { x: 205, y: 1089, railroadId: RailroadId.CSAR },
        { x: 812.5, y: 1106.5, railroadId: RailroadId.NRC },
        { x: 1359, y: 1031.5, railroadId: RailroadId.CdFM }
    ],
    printedLabels: {},
    regions: [],
    // The South African Railroads art, each drawing moved to open paper on this board.
    artwork: southAfricanArtwork([
        { kind: 'compass', x: 1038, y: 254 },
        { kind: 'acacia', x: 1290, y: 224, scale: 0.9 },
        { kind: 'acacia', x: 1350, y: 242, scale: 0.65 },
        { kind: 'diamond', x: 350, y: 560, scale: 0.85 },
        { kind: 'headframe', x: 1278, y: 1046, scale: 0.8 },
        { kind: 'mountains', x: 718, y: 1012, scale: 0.75 },
        { kind: 'acacia', x: 1182, y: 560, scale: 0.75 },
        { kind: 'ship', x: 1560, y: 1166, scale: 0.42 }
    ])
}

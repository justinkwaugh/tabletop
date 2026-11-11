import { RailroadId } from '@tabletop/south-african-railroads'
import type { BoardLayoutSpec } from '../boardLayout.js'

// Coordinates follow Fabian Peng Kärrholm's 2022 redraw.
export const PENNSYLVANIA_LAYOUT: BoardLayoutSpec = {
    width: 2040,
    top: 230,
    bottom: 1290,
    // The title stands large in the top-left corner above the order of metro areas, the legend and payoff bottom right.
    legend: { x: 1785, y: 1105 },
    finalPayoff: { x: 1715, y: 985 },
    logo: { x: 330, y: 290 },
    logoScale: 1.5,
    title: 'Pennsylvania Railroad',
    credit: 'John Bohrer · Winsome Games · map redrawn by Fabian Peng Kärrholm',
    automaticDevelopment: { x: 60, y: 352 },
    rules: {
        notes: [
            [
                'Five metro areas, each paying $3–6 as it develops, replace Johannesburg and Bloemfontein; natural resources ($1, developed $5) replace the agricultural railheads.'
            ],
            [
                'The free metro area moves on as each fills, in the numbered order: it develops free, needs no track, and develops when a second development is declined.'
            ],
            [
                'The P&LE’s home is Pittsburgh: it opens once track reaches it, and a double link may not run into and out of it.'
            ],
            [
                'Canadian connections cost $30 and pay a special dividend, but add nothing to a railroad’s value.'
            ],
            ['The opening auction runs C&O, B&O, NYC, B&M, PRR; the PRR buyer goes first.']
        ]
    },
    metroGrids: {
        chicago: { columns: 2, origin: { x: 288, y: 665 } },
        'st-louis': { columns: 2, origin: { x: 37, y: 1055 } },
        detroit: { columns: 2, origin: { x: 706, y: 605 } },
        cincinnati: { columns: 2, origin: { x: 570, y: 1002 } },
        pittsburgh: { columns: 2, origin: { x: 994, y: 834 } }
    },
    baseNames: [
        { x: 1300, y: 1262, railroadId: RailroadId.CO },
        { x: 1400, y: 1012, railroadId: RailroadId.BO },
        { x: 1610, y: 872, railroadId: RailroadId.NYC },
        { x: 1865, y: 641, railroadId: RailroadId.BM },
        { x: 1520, y: 948, railroadId: RailroadId.PRR }
    ],
    // Where track crowds every spot around the icon, the name sits a little further off.
    printedLabels: {
        charlottesville: { x: 1157, y: 1176 },
        chillicothe: { x: 695, y: 1040.5 }
    },
    regions: [],
    // The Great Lakes and the Atlantic shore, the Ohio and the Hudson, and a few drawings in open
    // paper near what they stand for.
    artwork: {
        tints: [
            { x: 230, y: 940, rx: 300, ry: 300, color: '#e9d79a' },
            { x: 1080, y: 1010, rx: 360, ry: 250, color: '#c5cfa6' },
            { x: 1760, y: 420, rx: 260, ry: 230, color: '#c9d3ae' }
        ],
        waters: [
            // Lake Michigan, Chicago on its southern shore
            [
                { x: 392, y: 652 },
                { x: 428, y: 600 },
                { x: 438, y: 520 },
                { x: 428, y: 440 },
                { x: 404, y: 372 },
                { x: 360, y: 350 },
                { x: 330, y: 400 },
                { x: 312, y: 480 },
                { x: 312, y: 560 },
                { x: 344, y: 620 }
            ],
            // Lake Erie, north of the shore line from Toledo to Buffalo
            [
                { x: 748, y: 672 },
                { x: 806, y: 680 },
                { x: 872, y: 670 },
                { x: 942, y: 638 },
                { x: 1010, y: 600 },
                { x: 1068, y: 566 },
                { x: 1048, y: 552 },
                { x: 988, y: 566 },
                { x: 918, y: 592 },
                { x: 856, y: 618 },
                { x: 790, y: 642 },
                { x: 754, y: 656 }
            ],
            // Lake Ontario, north of Rochester and Syracuse
            [
                { x: 1062, y: 470 },
                { x: 1130, y: 480 },
                { x: 1210, y: 474 },
                { x: 1286, y: 466 },
                { x: 1324, y: 448 },
                { x: 1304, y: 424 },
                { x: 1236, y: 412 },
                { x: 1156, y: 412 },
                { x: 1088, y: 426 },
                { x: 1050, y: 448 }
            ],
            // The Atlantic, from Maine down past New York
            [
                { x: 2080, y: 470 },
                { x: 1998, y: 482 },
                { x: 1964, y: 560 },
                { x: 1944, y: 640 },
                { x: 1924, y: 702 },
                { x: 1876, y: 748 },
                { x: 1790, y: 792 },
                { x: 1718, y: 832 },
                { x: 1684, y: 884 },
                { x: 1676, y: 960 },
                { x: 1682, y: 1060 },
                { x: 1688, y: 1180 },
                { x: 1694, y: 1320 },
                { x: 2080, y: 1320 }
            ]
        ],
        rivers: [
            {
                // The Ohio, from Pittsburgh down past Cincinnati and Louisville
                width: 3.4,
                points: [
                    { near: 'pittsburgh', dx: -12, dy: 52 },
                    { near: 'wheeling', dx: 14, dy: 28 },
                    { near: 'chillicothe', dx: 50, dy: 52 },
                    { near: 'cincinnati', dx: 30, dy: 70 },
                    { near: 'louisville', dx: 0, dy: -26 },
                    { near: 'evansville', dx: 0, dy: -26 },
                    { near: 'evansville', dx: -150, dy: 92 }
                ]
            },
            {
                // The Hudson, from Albany down to New York
                width: 3,
                points: [
                    { near: 'albany', dx: -24, dy: 30 },
                    { near: 'albany', dx: -26, dy: 120 },
                    { near: 'new-york', dx: -18, dy: -30 }
                ]
            }
        ],
        waterNames: [
            { text: 'LAKE MICHIGAN', x: 380, y: 452, rotate: -90 },
            { text: 'LAKE ERIE', x: 1004, y: 588, rotate: -24 },
            { text: 'LAKE ONTARIO', x: 1190, y: 452 },
            { text: 'ATLANTIC OCEAN', x: 1858, y: 906 }
        ],
        drawings: [
            { kind: 'compass', x: 830, y: 380, scale: 1.2 },
            { kind: 'pines', x: 1438, y: 300 },
            { kind: 'lighthouse', x: 1972, y: 540, scale: 0.8 },
            { kind: 'ship', x: 1880, y: 800, scale: 0.7 },
            { kind: 'liberty-bell', x: 1574, y: 1126, scale: 0.9 },
            { kind: 'steel-mill', x: 1382, y: 1146, scale: 0.85 },
            { kind: 'headframe', x: 718, y: 1210, scale: 0.85 },
            { kind: 'wheat', x: 134, y: 1198, scale: 0.9 }
        ]
    }
}

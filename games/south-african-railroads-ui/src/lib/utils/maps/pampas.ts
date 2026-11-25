import type { BoardLayoutSpec } from '../boardLayout.js'

// Coordinates follow Fabian Peng Kärrholm's 2023 redraw, shifted left past its income track. The
// title, rules and legend take the corners where the printed action, round and reference panels
// stood.
export const PAMPAS_LAYOUT: BoardLayoutSpec = {
    width: 1656,
    top: 20,
    bottom: 2000,
    legend: { x: 40, y: 1610 },
    finalPayoff: { x: 40, y: 1800 },
    logo: { x: 270, y: 130 },
    logoScale: 1.2,
    title: 'Pampas Railroads',
    credit: 'John Bohrer · Winsome Games · map redrawn by Fabian Peng Kärrholm',
    rules: {
        panel: { x: 30, y: 230, width: 261 },
        notes: [
            [
                'Each action fills the next box in its',
                'row; dividends follow once two rows',
                'are full.'
            ],
            [
                'Once a game, a special action takes',
                'any action, a full row too, and fills',
                'no box.'
            ],
            [
                'Any railroad may build: its largest',
                'shareholder lays the track, or you on',
                'a tie.'
            ],
            ['Buenos Aires must pay most of the', 'metro areas, Tucumán least.'],
            [
                'Opening railroads start from Buenos',
                'Aires on a link marked in their colour;',
                'the C&R opens once track reaches',
                'Córdoba, and starts to Cruz del Eje',
                'or Deán Funes.'
            ],
            [
                'Nine rounds: eight dividends, then',
                'the final payoff. Dividends from',
                'connections abroad round up.'
            ],
            ['Tied investors are ranked by shares', 'of the most valuable railroad.']
        ]
    },
    metroGrids: {
        tucuman: { columns: 2, origin: { x: 574, y: 210 } },
        cordoba: { columns: 3, origin: { x: 699.5, y: 839 } },
        rosario: { columns: 2, origin: { x: 1149, y: 1050 } },
        'buenos-aires': { columns: 2, origin: { x: 1341, y: 1269 } }
    },
    baseNames: [],
    printedLabels: {
        'bahia-blanca': { x: 966, y: 1950 }
    },
    regions: [
        { x: 1150, y: 600, lines: ['CHACO'] },
        { x: 340, y: 1030, lines: ['CUYO'] },
        { x: 560, y: 1690, lines: ['LA PAMPA'] },
        { x: 1240, y: 1600, lines: ['BUENOS AIRES'] }
    ],
    artwork: {
        tints: [
            { x: 1090, y: 420, rx: 330, ry: 260, color: '#c9d2a8' },
            { x: 300, y: 980, rx: 260, ry: 520, color: '#ead9a8' },
            { x: 1010, y: 1520, rx: 420, ry: 330, color: '#bfcca3' },
            { x: 600, y: 600, rx: 220, ry: 240, color: '#e6d6a0' }
        ],
        waters: [
            // The Río de la Plata and the Atlantic, from Buenos Aires round to Bahía Blanca
            [
                { x: 1680, y: 1190 },
                { x: 1580, y: 1226 },
                { x: 1490, y: 1250 },
                { near: 'buenos-aires', dx: 34, dy: -24 },
                { near: 'buenos-aires', dx: 46, dy: 18 },
                { near: 'la-plata', dx: -6, dy: -28 },
                { near: 'la-plata', dx: 104, dy: -22 },
                { x: 1630, y: 1420 },
                { x: 1636, y: 1530 },
                { x: 1600, y: 1640 },
                { near: 'mar-del-plata', dx: 52, dy: -36 },
                { near: 'mar-del-plata', dx: 18, dy: 24 },
                { near: 'tres-arroyos', dx: 120, dy: 82 },
                { near: 'tres-arroyos', dx: -60, dy: 100 },
                { near: 'bahia-blanca', dx: 50, dy: 40 },
                { near: 'bahia-blanca', dx: -30, dy: 64 },
                { x: 760, y: 2010 },
                { x: 1680, y: 2010 }
            ]
        ],
        rivers: [
            {
                // The Paraná, past Resistencia, Santa Fe, Rosario and San Nicolás to the delta
                width: 3.4,
                points: [
                    { x: 1470, y: 240 },
                    { near: 'resistencia', dx: 44, dy: 20 },
                    { near: 'resistencia', dx: 30, dy: 170 },
                    { near: 'santa-fe', dx: 110, dy: -150 },
                    { near: 'santa-fe', dx: 40, dy: 40 },
                    { near: 'rosario', dx: 62, dy: -6 },
                    { near: 'san-nicolas', dx: 40, dy: -10 },
                    { near: 'buenos-aires', dx: 20, dy: -40 }
                ]
            },
            {
                // The Uruguay, down the eastern edge to the Río de la Plata
                width: 3,
                points: [
                    { x: 1620, y: 420 },
                    { x: 1590, y: 700 },
                    { x: 1600, y: 960 },
                    { x: 1560, y: 1150 },
                    { x: 1520, y: 1236 }
                ]
            }
        ],
        waterNames: [
            { text: 'RÍO DE LA PLATA', x: 1560, y: 1300, rotate: -14 },
            { text: 'OCÉANO ATLÁNTICO', x: 1560, y: 1840, rotate: -60 },
            { text: 'RÍO PARANÁ', x: 1290, y: 820, rotate: -62 }
        ],
        drawings: [
            { kind: 'mountains', x: 110, y: 820 },
            { kind: 'mountains', x: 90, y: 1290, scale: 0.9 },
            { kind: 'headframe', x: 555, y: 400, scale: 0.85 },
            { kind: 'acacia', x: 1230, y: 470, scale: 0.9 },
            { kind: 'wheat', x: 480, y: 1870, scale: 0.9 },
            { kind: 'ship', x: 1560, y: 1380, scale: 0.7 },
            { kind: 'lighthouse', x: 1560, y: 1700, scale: 0.8 },
            { kind: 'compass', x: 1500, y: 640, scale: 1.1 }
        ]
    }
}

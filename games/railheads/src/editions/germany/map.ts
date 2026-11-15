import { HexOrientation } from '@tabletop/common'
import { Industry, SiteKind, printedHex, type MapDefinition } from '../types.js'

// Read from Gameboard Version 0.61.
const COUNTRYSIDE_ROWS_BY_COLUMN: readonly (readonly number[])[] = [
    [20, 24, 30],
    [23, 25, 27, 29, 31],
    [12, 14, 16, 20, 22, 24, 28, 30, 34],
    [7, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35],
    [8, 10, 12, 14, 18, 20, 22, 24, 26, 28, 32, 34],
    [1, 3, 9, 13, 15, 17, 19, 21, 23, 27, 29, 33, 35],
    [4, 6, 8, 10, 12, 16, 18, 22, 24, 26, 28, 30, 32, 34],
    [3, 7, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35],
    [6, 8, 10, 12, 16, 18, 20, 22, 24, 26, 30, 32, 34, 36],
    [9, 11, 13, 15, 17, 19, 23, 25, 27, 29, 31, 35],
    [8, 10, 12, 14, 18, 20, 22, 24, 26, 28, 32, 34],
    [5, 7, 9, 11, 13, 15, 17, 21, 25, 27, 29, 31, 33, 35],
    [8, 10, 12, 16, 18, 20, 22, 30, 32, 34],
    [7, 9, 11, 15, 17, 19]
]

export const GERMANY_MAP: MapDefinition = {
    orientation: HexOrientation.Flat,
    countryside: COUNTRYSIDE_ROWS_BY_COLUMN.flatMap((rows, col) =>
        rows.map((row) => printedHex(col, row))
    ),
    regions: [],
    demandAreas: [],
    water: [],
    sites: [
        { id: 'essen', name: 'Essen', kind: SiteKind.Town, hex: printedHex(1, 17) },
        { id: 'dusseldorf', name: 'Düsseldorf', kind: SiteKind.Town, hex: printedHex(1, 19) },
        { id: 'koln', name: 'Köln', kind: SiteKind.City, hex: printedHex(1, 21) },
        { id: 'dortmund', name: 'Dortmund', kind: SiteKind.City, hex: printedHex(2, 18) },
        { id: 'strassburg', name: 'Strassburg', kind: SiteKind.Town, hex: printedHex(2, 32) },
        { id: 'mulhausen', name: 'Mülhausen', kind: SiteKind.Town, hex: printedHex(2, 36) },
        { id: 'emden', name: 'Emden', kind: SiteKind.Town, hex: printedHex(3, 9) },
        { id: 'karlsruhe', name: 'Karlsruhe', kind: SiteKind.Town, hex: printedHex(4, 30) },
        { id: 'frankfurt', name: 'Frankfurt', kind: SiteKind.City, hex: printedHex(5, 25) },
        { id: 'stuttgart', name: 'Stuttgart', kind: SiteKind.Town, hex: printedHex(5, 31) },
        { id: 'flensburg', name: 'Flensburg', kind: SiteKind.Town, hex: printedHex(6, 2) },
        { id: 'hannover', name: 'Hannover', kind: SiteKind.City, hex: printedHex(6, 14) },
        { id: 'kiel', name: 'Kiel', kind: SiteKind.Town, hex: printedHex(7, 5) },
        { id: 'hamburg', name: 'Hamburg', kind: SiteKind.City, hex: printedHex(7, 9) },
        { id: 'nurnberg', name: 'Nürnberg', kind: SiteKind.Town, hex: printedHex(8, 28) },
        { id: 'lubeck', name: 'Lübeck', kind: SiteKind.Town, hex: printedHex(9, 7) },
        { id: 'erfurt', name: 'Erfurt', kind: SiteKind.Town, hex: printedHex(9, 21) },
        { id: 'munchen', name: 'München', kind: SiteKind.City, hex: printedHex(9, 33) },
        { id: 'magdeburg', name: 'Magdeburg', kind: SiteKind.Town, hex: printedHex(10, 16) },
        { id: 'regensburg', name: 'Regensburg', kind: SiteKind.Town, hex: printedHex(10, 30) },
        { id: 'leipzig', name: 'Leipzig', kind: SiteKind.City, hex: printedHex(11, 19) },
        { id: 'stralsund', name: 'Stralsund', kind: SiteKind.Town, hex: printedHex(12, 6) },
        { id: 'berlin', name: 'Berlin', kind: SiteKind.City, hex: printedHex(12, 14) },
        { id: 'dresden', name: 'Dresden', kind: SiteKind.Town, hex: printedHex(13, 21) },
        { id: 'passau', name: 'Passau', kind: SiteKind.Town, hex: printedHex(13, 31) }
    ],
    industrySites: [
        { industry: Industry.Grain, hex: printedHex(0, 22) },
        { industry: Industry.Cloth, hex: printedHex(0, 28) },
        { industry: Industry.Brick, hex: printedHex(1, 35) },
        { industry: Industry.Steel, hex: printedHex(2, 26) },
        { industry: Industry.Cloth, hex: printedHex(4, 16) },
        { industry: Industry.Cloth, hex: printedHex(5, 7) },
        { industry: Industry.Grain, hex: printedHex(5, 11) },
        { industry: Industry.Steel, hex: printedHex(6, 0) },
        { industry: Industry.Brick, hex: printedHex(6, 20) },
        { industry: Industry.Grain, hex: printedHex(6, 36) },
        { industry: Industry.Steel, hex: printedHex(8, 14) },
        { industry: Industry.Brick, hex: printedHex(10, 6) },
        { industry: Industry.Cloth, hex: printedHex(11, 23) },
        { industry: Industry.Grain, hex: printedHex(12, 28) },
        { industry: Industry.Brick, hex: printedHex(12, 36) },
        { industry: Industry.Steel, hex: printedHex(13, 13) }
    ]
}

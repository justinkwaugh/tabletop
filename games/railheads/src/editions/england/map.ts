import { HexOrientation, type AxialCoordinates } from '@tabletop/common'
import { Industry, SiteKind, printedHex, type MapDefinition } from '../types.js'

// Read from Gameboard Version 0.60. Columns count from the left of the map; rows are doubled,
// so a column's hexes sit on every other row. Written row first, as the board reads.
function hex(row: number, col: number): AxialCoordinates {
    return printedHex(col, row)
}

function hexes(row: number, cols: readonly number[]): AxialCoordinates[] {
    return cols.map((col) => hex(row, col))
}

// The designated regions of the Big Four, bounded by the board's dashed lines. London lies in
// none of them.
export enum Region {
    Midlands = 'Midlands',
    East = 'East',
    West = 'West',
    South = 'South'
}

const MIDLANDS_COUNTRY = [
    ...hexes(3, [11]),
    ...hexes(4, [10, 12]),
    ...hexes(5, [9, 11]),
    ...hexes(6, [10, 12]),
    ...hexes(7, [7]),
    ...hexes(8, [8, 10, 12]),
    ...hexes(9, [7, 11]),
    ...hexes(10, [6, 10, 12]),
    ...hexes(11, [13]),
    ...hexes(12, [12, 14]),
    ...hexes(13, [11, 13]),
    ...hexes(14, [12]),
    ...hexes(15, [13, 15]),
    ...hexes(16, [12, 14]),
    ...hexes(17, [11, 13, 15]),
    ...hexes(18, [12, 14]),
    ...hexes(19, [11, 13, 15]),
    ...hexes(20, [12, 14]),
    ...hexes(21, [11, 15]),
    ...hexes(22, [12, 14]),
    ...hexes(23, [13, 15])
]
const EAST_COUNTRY = [
    ...hexes(2, [12, 14, 16]),
    ...hexes(3, [13]),
    ...hexes(4, [14, 16]),
    ...hexes(5, [15, 17]),
    ...hexes(6, [14, 16]),
    ...hexes(7, [13, 15]),
    ...hexes(8, [14, 16]),
    ...hexes(9, [15, 17]),
    ...hexes(10, [14]),
    ...hexes(11, [15, 17]),
    ...hexes(12, [16]),
    ...hexes(13, [15]),
    ...hexes(14, [16, 18, 20]),
    ...hexes(15, [17, 19, 21]),
    ...hexes(16, [16, 18]),
    ...hexes(17, [17, 19]),
    ...hexes(18, [16, 18, 20]),
    ...hexes(19, [19, 21]),
    ...hexes(20, [16, 18, 20]),
    ...hexes(21, [17]),
    ...hexes(22, [16, 18]),
    ...hexes(23, [17]),
    ...hexes(24, [18]),
    ...hexes(25, [17])
]
const WEST_COUNTRY = [
    ...hexes(10, [8]),
    ...hexes(11, [7, 9]),
    ...hexes(12, [6, 10]),
    ...hexes(13, [7, 9]),
    ...hexes(14, [8, 10]),
    ...hexes(15, [5, 7, 9]),
    ...hexes(16, [4, 6, 8, 10]),
    ...hexes(17, [3, 5, 7, 9]),
    ...hexes(18, [4, 6, 8, 10]),
    ...hexes(19, [3, 7, 9]),
    ...hexes(20, [6, 8]),
    ...hexes(21, [9]),
    ...hexes(22, [10]),
    ...hexes(23, [5, 11]),
    ...hexes(24, [6, 8, 10, 12]),
    ...hexes(25, [3, 5, 7, 9, 13]),
    ...hexes(26, [4, 6, 8]),
    ...hexes(27, [3, 5, 7]),
    ...hexes(28, [2, 4, 6]),
    ...hexes(29, [3, 5])
]
const SOUTH_COUNTRY = [
    ...hexes(25, [11, 15]),
    ...hexes(26, [10, 12, 14, 16, 18]),
    ...hexes(27, [9, 11, 13, 15, 17]),
    ...hexes(28, [10, 14, 16, 18]),
    ...hexes(29, [9, 11, 17, 19]),
    ...hexes(30, [12, 16])
]

const SITE_REGIONS: Readonly<Record<Region, readonly AxialCoordinates[]>> = {
    [Region.Midlands]: [
        hex(2, 10),
        hex(7, 9),
        hex(7, 11),
        hex(8, 6),
        hex(9, 5),
        hex(9, 9),
        hex(11, 11),
        hex(14, 14),
        hex(15, 11),
        hex(21, 13),
        hex(24, 14)
    ],
    [Region.East]: [
        hex(3, 15),
        hex(3, 17),
        hex(5, 13),
        hex(9, 13),
        hex(10, 16),
        hex(13, 19),
        hex(16, 20),
        hex(17, 21),
        hex(19, 17),
        hex(21, 19)
    ],
    [Region.West]: [
        hex(12, 8),
        hex(14, 6),
        hex(16, 2),
        hex(18, 2),
        hex(19, 5),
        hex(20, 10),
        hex(21, 7),
        hex(23, 9),
        hex(24, 4),
        hex(29, 1),
        hex(30, 0),
        hex(30, 4)
    ],
    [Region.South]: [hex(27, 19), hex(28, 8), hex(28, 12), hex(29, 13), hex(29, 15), hex(30, 20)]
}

const COUNTRY: Readonly<Record<Region, readonly AxialCoordinates[]>> = {
    [Region.Midlands]: MIDLANDS_COUNTRY,
    [Region.East]: EAST_COUNTRY,
    [Region.West]: WEST_COUNTRY,
    [Region.South]: SOUTH_COUNTRY
}

export const ENGLAND_MAP: MapDefinition = {
    orientation: HexOrientation.Flat,
    countryside: Object.values(COUNTRY).flat(),
    sites: [
        { id: 'lancaster', name: 'Lancaster', kind: SiteKind.Town, hex: hex(2, 10) },
        { id: 'york', name: 'York', kind: SiteKind.Town, hex: hex(3, 15) },
        { id: 'leeds', name: 'Leeds', kind: SiteKind.City, hex: hex(5, 13) },
        { id: 'liverpool', name: 'Liverpool', kind: SiteKind.City, hex: hex(7, 9) },
        { id: 'bangor', name: 'Bangor', kind: SiteKind.Town, hex: hex(8, 6) },
        { id: 'sheffield', name: 'Sheffield', kind: SiteKind.Town, hex: hex(9, 13) },
        { id: 'stoke', name: 'Stoke-on-Trent', kind: SiteKind.Town, hex: hex(11, 11) },
        { id: 'wrexham', name: 'Wrexham', kind: SiteKind.Town, hex: hex(12, 8) },
        { id: 'leicester', name: 'Leicester', kind: SiteKind.City, hex: hex(14, 14) },
        { id: 'norwich', name: 'Norwich', kind: SiteKind.Town, hex: hex(16, 20) },
        { id: 'milford-haven', name: 'Milford Haven', kind: SiteKind.Town, hex: hex(18, 2) },
        { id: 'swansea', name: 'Swansea', kind: SiteKind.Town, hex: hex(19, 5) },
        { id: 'cambridge', name: 'Cambridge', kind: SiteKind.Town, hex: hex(19, 17) },
        { id: 'cardiff', name: 'Cardiff', kind: SiteKind.City, hex: hex(21, 7) },
        { id: 'oxford', name: 'Oxford', kind: SiteKind.Town, hex: hex(21, 13) },
        { id: 'ipswich', name: 'Ipswich', kind: SiteKind.Town, hex: hex(21, 19) },
        { id: 'bristol', name: 'Bristol', kind: SiteKind.City, hex: hex(23, 9) },
        { id: 'reading', name: 'Reading', kind: SiteKind.Town, hex: hex(24, 14) },
        // London pays +7, holds three discs and earns no Running Rights.
        { id: 'london', name: 'London', kind: SiteKind.City, hex: hex(24, 16), revenue: 7 },
        { id: 'southampton', name: 'Southampton', kind: SiteKind.City, hex: hex(28, 12) },
        { id: 'brighton', name: 'Brighton', kind: SiteKind.Town, hex: hex(29, 15) },
        { id: 'truro', name: 'Truro', kind: SiteKind.Town, hex: hex(30, 0) },
        { id: 'plymouth', name: 'Plymouth', kind: SiteKind.Town, hex: hex(30, 4) },
        { id: 'france', name: 'France', kind: SiteKind.City, hex: hex(30, 20) }
    ],
    industrySites: [
        { industry: Industry.Cloth, hex: hex(3, 17) },
        { industry: Industry.Grain, hex: hex(7, 11) },
        { industry: Industry.Steel, hex: hex(9, 5) },
        { industry: Industry.Brick, hex: hex(9, 9) },
        { industry: Industry.Brick, hex: hex(10, 16) },
        { industry: Industry.Grain, hex: hex(13, 19) },
        { industry: Industry.Cloth, hex: hex(14, 6) },
        { industry: Industry.Steel, hex: hex(15, 11) },
        { industry: Industry.Grain, hex: hex(16, 2) },
        { industry: Industry.Cloth, hex: hex(17, 21) },
        { industry: Industry.Grain, hex: hex(20, 10) },
        { industry: Industry.Cloth, hex: hex(24, 4) },
        { industry: Industry.Brick, hex: hex(27, 19) },
        { industry: Industry.Brick, hex: hex(28, 8) },
        { industry: Industry.Steel, hex: hex(29, 1) },
        { industry: Industry.Steel, hex: hex(29, 13) }
    ],
    regions: Object.values(Region).map((region) => ({
        id: region,
        name: `The ${region}`,
        hexes: [...COUNTRY[region], ...SITE_REGIONS[region]]
    })),
    demandAreas: [],
    water: []
}

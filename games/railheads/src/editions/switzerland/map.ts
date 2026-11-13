import { HexOrientation, type AxialCoordinates } from '@tabletop/common'
import {
    HexKind,
    Industry,
    SiteKind,
    printedPointyHex as hex,
    type MapDefinition,
    type RegionDefinition
} from '../types.js'

// Read from the board printed in rulebook v0.60. Rows count down from the top of the map;
// columns are doubled, so a row's hexes sit on every other column.
function hexes(row: number, cols: readonly number[]): AxialCoordinates[] {
    return cols.map((col) => hex(row, col))
}

export enum Country {
    France = 'France',
    Germany = 'Germany',
    Austria = 'Austria',
    Italy = 'Italy'
}

// Each neighbour's flag marks the Industry Sites that earn its subsidy.
const COUNTRIES: readonly RegionDefinition[] = [
    { id: Country.France, name: 'France', hexes: [hex(3, 11), hex(8, 6), hex(14, 4)] },
    { id: Country.Germany, name: 'Germany', hexes: [hex(2, 20), hex(1, 27), hex(1, 35)] },
    { id: Country.Austria, name: 'Austria', hexes: [hex(5, 39), hex(7, 43)] },
    {
        id: Country.Italy,
        name: 'Italy',
        hexes: [hex(16, 14), hex(14, 24), hex(15, 27), hex(14, 40), hex(12, 44)]
    }
]

export const SWITZERLAND_MAP: MapDefinition = {
    orientation: HexOrientation.Pointy,
    countryside: [
        ...hexes(2, [28, 30, 34]),
        ...hexes(3, [13, 21, 23, 25, 27, 31, 33, 35]),
        ...hexes(4, [12, 14, 16, 18, 20, 24, 28, 30, 32, 34, 38]),
        ...hexes(5, [13, 15, 17, 19, 21, 23, 25, 31, 33, 35, 37]),
        ...hexes(6, [10, 12, 16, 18, 22, 24, 26, 28, 30, 34, 36]),
        ...hexes(7, [9, 13, 15, 17, 19, 21, 23, 29, 31, 33, 35, 37]),
        ...hexes(8, [8, 12, 14, 18, 20, 24, 26, 30, 32, 34, 38, 40]),
        ...hexes(9, [7, 11, 13, 19]),
        ...hexes(10, [6, 8, 10, 12]),
        ...hexes(11, [5, 7]),
        ...hexes(12, [4, 20, 22, 30]),
        ...hexes(13, [3, 17, 27, 29, 31, 33]),
        ...hexes(14, [12, 16, 30]),
        ...hexes(15, [13, 29])
    ],
    hillside: [
        ...hexes(9, [15, 17, 21, 23, 25, 29, 31, 33, 35, 37, 43, 45]),
        ...hexes(10, [14, 42, 44]),
        ...hexes(11, [13, 21, 23, 31, 33, 35, 37, 41, 43, 45]),
        ...hexes(12, [10, 16, 24, 26, 28, 32, 34, 36, 38, 40]),
        ...hexes(13, [11, 13, 19, 23, 37, 41]),
        ...hexes(14, [18, 20, 22, 38]),
        ...hexes(15, [21])
    ],
    sites: [
        { id: 'schaffhausen', name: 'Schaffhausen', kind: SiteKind.Town, hex: hex(2, 26) },
        { id: 'frauenfeld', name: 'Frauenfeld', kind: SiteKind.Town, hex: hex(2, 32) },
        { id: 'basel', name: 'Basel', kind: SiteKind.City, hex: hex(3, 19) },
        { id: 'winterthur', name: 'Winterthur', kind: SiteKind.City, hex: hex(3, 29) },
        { id: 'aarau', name: 'Aarau', kind: SiteKind.Town, hex: hex(4, 22) },
        { id: 'zurich', name: 'Zurich', kind: SiteKind.City, hex: hex(4, 26) },
        { id: 'st-gallen', name: 'St. Gallen', kind: SiteKind.City, hex: hex(4, 36) },
        { id: 'biel', name: 'Biel', kind: SiteKind.Town, hex: hex(6, 14) },
        { id: 'neuchatel', name: 'Neuchâtel', kind: SiteKind.Town, hex: hex(7, 11) },
        { id: 'lucerne', name: 'Lucerne', kind: SiteKind.City, hex: hex(7, 25) },
        { id: 'bern', name: 'Bern', kind: SiteKind.City, hex: hex(8, 16) },
        { id: 'alpnachstad', name: 'Alpnachstad', kind: SiteKind.Town, hex: hex(8, 22) },
        { id: 'altdorf', name: 'Altdorf', kind: SiteKind.Town, hex: hex(8, 28) },
        { id: 'chur', name: 'Chur', kind: SiteKind.City, hex: hex(8, 36) },
        { id: 'scuol', name: 'Scuol', kind: SiteKind.Town, hex: hex(8, 44) },
        { id: 'davos', name: 'Davos', kind: SiteKind.Town, hex: hex(9, 39) },
        { id: 'lausanne', name: 'Lausanne', kind: SiteKind.City, hex: hex(11, 9) },
        { id: 'montreux', name: 'Montreux', kind: SiteKind.Town, hex: hex(11, 11) },
        { id: 'st-moritz', name: 'St. Moritz', kind: SiteKind.Town, hex: hex(11, 39) },
        { id: 'geneva', name: 'Geneva', kind: SiteKind.City, hex: hex(13, 5) },
        { id: 'sion', name: 'Sion', kind: SiteKind.City, hex: hex(13, 15) },
        { id: 'brig', name: 'Brig', kind: SiteKind.Town, hex: hex(13, 21) },
        { id: 'locarno', name: 'Locarno', kind: SiteKind.Town, hex: hex(14, 28) },
        { id: 'bellinzona', name: 'Bellinzona', kind: SiteKind.Town, hex: hex(14, 32) },
        { id: 'zermatt', name: 'Zermatt', kind: SiteKind.Town, hex: hex(15, 19) },
        { id: 'lugano', name: 'Lugano', kind: SiteKind.City, hex: hex(15, 31) }
    ],
    industrySites: [
        { industry: Industry.Steel, hex: hex(1, 27) },
        { industry: Industry.Grain, hex: hex(1, 35) },
        { industry: Industry.Brick, hex: hex(2, 20) },
        { industry: Industry.Cloth, hex: hex(3, 11) },
        { industry: Industry.Brick, hex: hex(5, 39) },
        { industry: Industry.Grain, hex: hex(6, 20) },
        { industry: Industry.Cloth, hex: hex(6, 32) },
        { industry: Industry.Cloth, hex: hex(7, 43) },
        { industry: Industry.Steel, hex: hex(8, 6) },
        { industry: Industry.Steel, hex: hex(12, 18) },
        { industry: Industry.Brick, hex: hex(12, 44) },
        { industry: Industry.Grain, hex: hex(14, 4) },
        { industry: Industry.Brick, hex: hex(14, 24) },
        { industry: Industry.Steel, hex: hex(14, 40) },
        { industry: Industry.Grain, hex: hex(15, 27) },
        { industry: Industry.Cloth, hex: hex(16, 14) }
    ],
    regions: COUNTRIES,
    demandAreas: [],
    water: [
        hex(2, 36),
        hex(3, 37),
        hex(5, 27),
        hex(5, 29),
        hex(7, 27),
        hex(8, 10),
        hex(9, 9),
        hex(12, 6),
        hex(12, 8)
    ],
    // The first hex of a tunnel holds its disc.
    tolls: [
        {
            id: 'lotschberg',
            name: 'Lötschberg',
            kind: HexKind.Tunnel,
            hexes: [hex(10, 18), hex(11, 19)],
            stars: 4
        },
        { id: 'sanetsch', name: 'Sanetsch', kind: HexKind.Tunnel, hexes: [hex(12, 14)], stars: 2 },
        {
            id: 'st-bernard',
            name: 'St. Bernard',
            kind: HexKind.Tunnel,
            hexes: [hex(15, 15)],
            stars: 2
        },
        {
            id: 'gotthard',
            name: 'Gotthard',
            kind: HexKind.Tunnel,
            hexes: [hex(10, 28), hex(9, 27), hex(11, 29)],
            stars: 6
        },
        { id: 'albula', name: 'Albula', kind: HexKind.Tunnel, hexes: [hex(10, 38)], stars: 2 },
        { id: 'vereina', name: 'Vereina', kind: HexKind.Tunnel, hexes: [hex(9, 41)], stars: 2 }
    ],
    peaks: [
        { name: 'Giferspitz', hex: hex(10, 16) },
        { name: 'Aletschhorn', hex: hex(10, 20) },
        { name: 'Finsteraarhorn', hex: hex(10, 22) },
        { name: 'Gärstenhörner', hex: hex(10, 24) },
        { name: 'Galenstock', hex: hex(10, 26) },
        { name: 'Rheinwaldhorn', hex: hex(10, 30) },
        { name: 'Bruschghorn', hex: hex(10, 32) },
        { name: 'Piz Platta', hex: hex(10, 34) },
        { name: 'Piz Calderas', hex: hex(10, 36) },
        { name: 'Piz Kesch', hex: hex(10, 40) },
        { name: 'Wildhorn', hex: hex(11, 15) },
        { name: 'Rinderhorn', hex: hex(11, 17) },
        { name: 'Pizzo Gallina', hex: hex(11, 25) },
        { name: 'Pizzo Rotondo', hex: hex(11, 27) },
        { name: 'Sommet des Diablerets', hex: hex(12, 12) },
        { name: 'Le Portalet', hex: hex(14, 14) },
        { name: 'Matterhorn', hex: hex(15, 17) }
    ]
}

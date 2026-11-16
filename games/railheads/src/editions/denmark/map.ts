import { HexOrientation, type AxialCoordinates } from '@tabletop/common'
import {
    HexKind,
    Industry,
    SiteKind,
    printedHex,
    type MapDefinition,
    type TollDefinition
} from '../types.js'

// Read from Gameboard Version 0.62. Columns count from the left of the map; rows are doubled,
// so a column's hexes sit on every other row. Written row first, as the board reads.
function hex(row: number, col: number): AxialCoordinates {
    return printedHex(col, row)
}

function hexes(row: number, cols: readonly number[]): AxialCoordinates[] {
    return cols.map((col) => hex(row, col))
}

function bridge(id: string, name: string, row: number, col: number, stars: number): TollDefinition {
    return { id, name, kind: HexKind.Bridge, hexes: [hex(row, col)], stars }
}

export const DENMARK_MAP: MapDefinition = {
    orientation: HexOrientation.Flat,
    countryside: [
        ...hexes(3, [9]),
        ...hexes(4, [10]),
        ...hexes(5, [9]),
        ...hexes(6, [8, 10]),
        ...hexes(7, [7, 9]),
        ...hexes(8, [6, 8, 10]),
        ...hexes(9, [5, 9]),
        ...hexes(11, [3]),
        ...hexes(12, [6, 8]),
        ...hexes(13, [7, 9]),
        ...hexes(14, [2, 6, 8]),
        ...hexes(15, [3, 5, 7, 9]),
        ...hexes(16, [4, 8, 10]),
        ...hexes(17, [3, 5, 7, 11]),
        ...hexes(18, [2, 4, 6, 8, 10]),
        ...hexes(19, [3, 5, 7, 9]),
        ...hexes(20, [2, 4, 6, 8]),
        ...hexes(21, [5, 7]),
        ...hexes(22, [4, 6, 8]),
        ...hexes(23, [3, 5, 7, 9, 17]),
        ...hexes(24, [4, 6, 8, 14, 16]),
        ...hexes(25, [3, 5, 13, 17]),
        ...hexes(26, [2, 4, 6, 14, 16]),
        ...hexes(27, [5, 7, 13, 15]),
        ...hexes(28, [4, 6, 14, 16]),
        ...hexes(29, [5, 9, 11, 13, 15, 17]),
        ...hexes(30, [4, 6, 10, 14, 16]),
        ...hexes(31, [5, 7, 9, 13]),
        ...hexes(32, [4, 10, 16]),
        ...hexes(33, [5, 7, 11, 17]),
        ...hexes(34, [4, 6]),
        ...hexes(35, [5, 7, 13, 15]),
        ...hexes(36, [4, 6, 12, 14, 16]),
        ...hexes(37, [5]),
        ...hexes(38, [6, 8, 14]),
        ...hexes(39, [5, 7]),
        ...hexes(40, [4, 6, 8, 10]),
        ...hexes(41, [5, 7, 9, 11]),
        ...hexes(42, [6, 10, 12]),
        ...hexes(43, [7, 9])
    ],
    sites: [
        { id: 'skagen', name: 'Skagen', kind: SiteKind.City, hex: hex(2, 10) },
        { id: 'thisted', name: 'Thisted', kind: SiteKind.Town, hex: hex(10, 4) },
        { id: 'aalborg', name: 'Aalborg', kind: SiteKind.City, hex: hex(11, 7) },
        { id: 'viborg', name: 'Viborg', kind: SiteKind.Town, hex: hex(16, 6) },
        { id: 'randers', name: 'Randers', kind: SiteKind.Town, hex: hex(17, 9) },
        { id: 'ringkobing', name: 'Ringkøbing', kind: SiteKind.Town, hex: hex(21, 3) },
        { id: 'aarhus', name: 'Aarhus', kind: SiteKind.City, hex: hex(21, 9) },
        { id: 'helsingor', name: 'Helsingør', kind: SiteKind.Town, hex: hex(21, 17) },
        { id: 'helsingborg', name: 'Helsingborg', kind: SiteKind.Town, hex: hex(21, 19) },
        { id: 'vejle', name: 'Vejle', kind: SiteKind.Town, hex: hex(25, 7) },
        { id: 'roskilde', name: 'Roskilde', kind: SiteKind.Town, hex: hex(25, 15) },
        { id: 'kalundborg', name: 'Kalundborg', kind: SiteKind.Town, hex: hex(26, 12) },
        { id: 'esbjerg', name: 'Esbjerg', kind: SiteKind.City, hex: hex(27, 3) },
        // The capital pays +7, as the rulebook's Figure 5 notes.
        {
            id: 'copenhagen',
            name: 'Copenhagen',
            kind: SiteKind.City,
            hex: hex(27, 17),
            revenue: 7
        },
        { id: 'malmo', name: 'Malmö', kind: SiteKind.City, hex: hex(27, 19) },
        { id: 'odense', name: 'Odense', kind: SiteKind.City, hex: hex(28, 10) },
        { id: 'nyborg', name: 'Nyborg', kind: SiteKind.Town, hex: hex(31, 11) },
        { id: 'naestved', name: 'Næstved', kind: SiteKind.Town, hex: hex(31, 15) },
        { id: 'aabenraa', name: 'Aabenraa', kind: SiteKind.Town, hex: hex(32, 6) },
        { id: 'flensborg', name: 'Flensborg', kind: SiteKind.Town, hex: hex(37, 7) },
        { id: 'rodby', name: 'Rødby', kind: SiteKind.Town, hex: hex(37, 13) },
        { id: 'puttgarden', name: 'Puttgarden', kind: SiteKind.Town, hex: hex(40, 12) },
        { id: 'kiel', name: 'Kiel', kind: SiteKind.City, hex: hex(42, 8) },
        { id: 'meldorf', name: 'Meldorf', kind: SiteKind.Town, hex: hex(43, 5) }
    ],
    industrySites: [
        { industry: Industry.Steel, hex: hex(4, 8) },
        { industry: Industry.Brick, hex: hex(10, 10) },
        { industry: Industry.Cloth, hex: hex(13, 5) },
        { industry: Industry.Grain, hex: hex(16, 2) },
        { industry: Industry.Steel, hex: hex(19, 11) },
        { industry: Industry.Brick, hex: hex(22, 16) },
        { industry: Industry.Brick, hex: hex(24, 2) },
        { industry: Industry.Grain, hex: hex(27, 9) },
        { industry: Industry.Cloth, hex: hex(34, 8) },
        { industry: Industry.Cloth, hex: hex(37, 15) },
        { industry: Industry.Steel, hex: hex(38, 4) },
        { industry: Industry.Grain, hex: hex(43, 11) }
    ],
    regions: [],
    demandAreas: [],
    water: [],
    tolls: [
        bridge('limfjord', 'Limfjord Bridge', 9, 7, 1),
        bridge('aggersund', 'Aggersund Bridge', 10, 6, 1),
        bridge('hals-egense', 'Hals - Egense', 11, 9, 2),
        bridge('oddesund', 'Oddesund Bridge', 13, 3, 3),
        bridge('helsingor-helsingborg', 'Helsingør - Helsingborg', 22, 18, 2),
        bridge('oresund', 'Øresund Bridge', 26, 18, 1),
        bridge('new-little-belt', 'New Little Belt Bridge', 28, 8, 2),
        bridge('great-belt-west', 'Great Belt Bridge', 28, 12, 1),
        bridge('old-little-belt', 'Old Little Belt Bridge', 30, 8, 2),
        bridge('great-belt-east', 'Great Belt Bridge', 30, 12, 1),
        bridge('storstrom', 'Storstrøm Bridge', 33, 15, 1),
        bridge('faro', 'Farø Bridge', 34, 16, 2),
        bridge('rodby-puttgarden', 'Rødby - Puttgarden', 39, 13, 3)
    ]
}

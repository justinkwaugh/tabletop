import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as cityFace,
    createSeparateCitiesTileFace as citiesFace,
    createTownTileFace as townFace,
    sameStopCounts,
    type SeparateCity,
    type TileDefinition,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1867:${printedNumber}`, printedNumber, aliases: [], scope: '1867', face }
}

const AllEdges = [0, 1, 2, 3, 4, 5] as const

/** Labels of the cities with tiles of their own (§8.6). */
export const YLabel = 'Y'
export const MontrealLabel = 'M'
export const TorontoLabel = 'T'
export const OttawaLabel = 'O'

export const TileColorOrder1867: readonly string[] = ['white', 'yellow', 'green', 'brown', 'gray']

const montrealGreen = (pairs: readonly (readonly [TileEdge, TileEdge])[]): TileFace =>
    citiesFace(
        'green',
        pairs.map((edges): SeparateCity => ({ edges, revenue: 50, stationSlots: 1 })),
        [MontrealLabel]
    )
const montrealBrown = (
    twoStationEdges: readonly TileEdge[],
    oneStationEdges: readonly TileEdge[]
): TileFace =>
    citiesFace(
        'brown',
        [
            { edges: twoStationEdges, revenue: 70, stationSlots: 2 },
            { edges: oneStationEdges, revenue: 70, stationSlots: 1 }
        ],
        [MontrealLabel]
    )
const torontoCities = (color: string, revenue: number, stationSlots: number): TileFace =>
    citiesFace(
        color,
        [
            { edges: [0, 1], revenue, stationSlots },
            { edges: [2, 3], revenue, stationSlots }
        ],
        [TorontoLabel]
    )

export const TileCatalog1867 = new TileCatalog([
    titleTile('87', townFace('green', [[0, 1, 2, 3]], 10)),
    titleTile('88', townFace('green', [[0, 1, 3, 4]], 10)),
    titleTile('204', townFace('green', [[0, 2, 3, 4]], 10)),
    titleTile('911', townFace('brown', [[0, 1, 2, 3, 4]], 10)),
    // Ottawa upgrades as a Y city until its grey O (§8.6).
    titleTile('201', cityFace('yellow', [0, 1], 30, 1, [YLabel])),
    titleTile('202', cityFace('yellow', [0, 2], 30, 1, [YLabel])),
    titleTile('621', cityFace('yellow', [0, 3], 30, 1, [YLabel])),
    titleTile('207', cityFace('green', [0, 1, 2, 3], 40, 2, [YLabel])),
    titleTile('208', cityFace('green', [0, 1, 3, 4], 40, 2, [YLabel])),
    titleTile('622', cityFace('green', [0, 2, 3, 4], 40, 2, [YLabel])),
    titleTile('623', cityFace('brown', AllEdges, 50, 2, [YLabel])),
    titleTile('801', cityFace('brown', [0, 1, 2, 3], 50, 2, [YLabel])),
    titleTile('X8', cityFace('gray', AllEdges, 60, 3, [OttawaLabel])),
    titleTile(
        '637',
        montrealGreen([
            [0, 1],
            [2, 3],
            [4, 5]
        ])
    ),
    titleTile(
        'X1',
        montrealGreen([
            [0, 3],
            [1, 4],
            [2, 5]
        ])
    ),
    titleTile(
        'X2',
        montrealGreen([
            [0, 3],
            [1, 5],
            [2, 4]
        ])
    ),
    titleTile(
        'X3',
        montrealGreen([
            [0, 4],
            [1, 2],
            [3, 5]
        ])
    ),
    titleTile(
        'X4',
        montrealGreen([
            [0, 3],
            [1, 2],
            [4, 5]
        ])
    ),
    titleTile('X5', montrealBrown([1, 2, 4, 5], [0, 3])),
    titleTile('X6', montrealBrown([0, 3, 4, 5], [1, 2])),
    titleTile('X7', montrealBrown([0, 1, 3, 5], [2, 4])),
    titleTile('639', cityFace('gray', AllEdges, 100, 4, [MontrealLabel])),
    titleTile('120', torontoCities('green', 60, 1)),
    titleTile('122', torontoCities('brown', 80, 2)),
    titleTile('124', cityFace('gray', [0, 1, 2, 3], 100, 4, [TorontoLabel]))
])

/** Montreal's separate stations join to two in brown and one in grey, Toronto's to one in grey (§8.6). */
export function preservesStops1867(before: TileFace, after: TileFace): boolean {
    return (
        sameStopCounts(before, after) ||
        [MontrealLabel, TorontoLabel].some(
            (label) => before.labels.includes(label) && after.labels.includes(label)
        )
    )
}

/** Ottawa's grey tile (§8.6). */
export const OttawaGreyTileId = '1867:X8'

// The tile manifest's counts (§19.2); plain yellow track is unlimited (§8.6.1).
const StandardCounts: Readonly<Record<string, number | 'unlimited'>> = {
    '3': 2,
    '4': 4,
    '5': 2,
    '6': 2,
    '7': 'unlimited',
    '8': 'unlimited',
    '9': 'unlimited',
    '57': 2,
    '58': 4,
    '14': 2,
    '15': 4,
    '16': 2,
    '17': 2,
    '18': 2,
    '19': 2,
    '20': 2,
    '21': 2,
    '22': 2,
    '23': 5,
    '24': 5,
    '25': 4,
    '26': 2,
    '27': 2,
    '28': 2,
    '29': 2,
    '30': 2,
    '31': 2,
    '619': 2,
    '624': 1,
    '625': 1,
    '626': 1,
    '39': 2,
    '40': 2,
    '41': 2,
    '42': 2,
    '43': 2,
    '44': 2,
    '45': 2,
    '46': 2,
    '47': 2,
    '63': 3,
    '70': 2,
    '611': 3
}
const TitleCounts: Readonly<Record<string, number>> = {
    '87': 2,
    '88': 2,
    '204': 2,
    '911': 3,
    '201': 3,
    '202': 3,
    '621': 2,
    '207': 5,
    '208': 2,
    '622': 2,
    '623': 3,
    '801': 2,
    X8: 1,
    '637': 1,
    X1: 1,
    X2: 1,
    X3: 1,
    X4: 1,
    X5: 1,
    X6: 1,
    X7: 1,
    '639': 1,
    '120': 1,
    '122': 1,
    '124': 1
}

export const TileSet1867 = new TileSet(
    {
        id: '1867:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1867:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1867]
)
export const Tiles1867 = TileSet1867.definitions

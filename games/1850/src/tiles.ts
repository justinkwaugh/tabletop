import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace,
    createSeparateCitiesTileFace,
    type TileDefinition,
    type TileFace
} from '@tabletop/18xx'

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1850:${printedNumber}`, printedNumber, aliases: [], scope: '1850', face }
}

const AllEdges = [0, 1, 2, 3, 4, 5] as const

export const ChicagoYellowTileId = '1850:128'

// Chicago's two cities and their single city from brown (§6.1.3), Milwaukee's own tiles, and the
// large cities' brown and grey (§6.4.3, §22).
export const TileCatalog1850 = new TileCatalog([
    titleTile(
        '128',
        createSeparateCitiesTileFace(
            'yellow',
            [
                { edges: [0], revenue: 30, stationSlots: 1 },
                { edges: [2], revenue: 30, stationSlots: 1 }
            ],
            ['C']
        )
    ),
    titleTile(
        '129',
        createSeparateCitiesTileFace(
            'green',
            [
                { edges: [0, 5], revenue: 50, stationSlots: 1 },
                { edges: [1, 2], revenue: 50, stationSlots: 2 }
            ],
            ['C']
        )
    ),
    titleTile('130', createCityTileFace('brown', [0, 1, 2, 5], 70, 4, ['C'])),
    titleTile('131', createCityTileFace('gray', [0, 1, 2, 4, 5], 100, 4, ['C'])),
    titleTile('132', createCityTileFace('green', [0, 1, 2], 30, 2, ['M'])),
    titleTile('133', createCityTileFace('brown', [0, 1, 2], 50, 2, ['M'])),
    titleTile('134', createCityTileFace('gray', [0, 1, 2], 60, 3, ['M'])),
    titleTile('135', createCityTileFace('brown', [0, 1, 3, 4, 5], 50, 2, ['P'])),
    titleTile('138', createCityTileFace('gray', AllEdges, 60, 2, ['P']))
])

// §22.
const StandardCounts: Readonly<Record<string, number>> = {
    '1': 1,
    '2': 1,
    '3': 3,
    '4': 4,
    '5': 2,
    '6': 2,
    '7': 6,
    '8': 20,
    '9': 20,
    '55': 1,
    '56': 1,
    '57': 5,
    '58': 4,
    '69': 1,
    '14': 4,
    '15': 4,
    '16': 1,
    '17': 1,
    '18': 1,
    '19': 1,
    '20': 1,
    '23': 4,
    '24': 4,
    '25': 1,
    '26': 1,
    '27': 1,
    '28': 1,
    '29': 1,
    '141': 1,
    '142': 1,
    '143': 1,
    '144': 1,
    '39': 1,
    '40': 1,
    '41': 3,
    '42': 3,
    '43': 2,
    '44': 1,
    '45': 2,
    '46': 2,
    '47': 2,
    '63': 4,
    '70': 1,
    '145': 1,
    '146': 1,
    '147': 1
}
const TitleCounts: Readonly<Record<string, number>> = {
    '128': 1,
    '129': 1,
    '130': 1,
    '131': 1,
    '132': 1,
    '133': 1,
    '134': 1,
    '135': 3,
    '138': 2
}

export const TileSet1850 = new TileSet(
    {
        id: '1850:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1850:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1850]
)
export const Tiles1850 = TileSet1850.definitions

/** The yellow tiles an extra lay may place (§6.1.2): Chicago's #128 only counts for its own hex. */
export const YellowTileIds1850: readonly string[] = [
    ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '55', '56', '57', '58', '69'].map(
        (number) => `18xx:${number}`
    ),
    ChicagoYellowTileId
]

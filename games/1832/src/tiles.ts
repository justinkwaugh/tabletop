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
    return { id: `1832:${printedNumber}`, printedNumber, aliases: [], scope: '1832', face }
}

// Atlanta's own tiles, and the brown cities only Charleston, Jacksonville (Y) and Savannah (S)
// may take (§6.4.4).
export const EighteenThirtyTwoTileCatalog = new TileCatalog([
    titleTile(
        '190',
        createSeparateCitiesTileFace(
            'green',
            [
                { edges: [5, 2], revenue: 40, stationSlots: 1 },
                { edges: [3, 0], revenue: 40, stationSlots: 1 },
                { edges: [4, 1], revenue: 40, stationSlots: 1 }
            ],
            ['A']
        )
    ),
    titleTile('191', createCityTileFace('brown', [0, 1, 2, 3, 4, 5], 60, 4, ['A'])),
    titleTile('193', createCityTileFace('brown', [0, 1, 2, 3], 40, 2, ['S'])),
    titleTile('611', createCityTileFace('brown', [0, 1, 2, 3, 4], 40, 2, ['Y']))
])

// The tile manifest (§23).
const StandardCounts: Readonly<Record<string, number>> = {
    '1': 1,
    '2': 1,
    '3': 3,
    '4': 4,
    '5': 2,
    '6': 2,
    '7': 7,
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
const TitleCounts: Readonly<Record<string, number>> = { '190': 1, '191': 1, '193': 1, '611': 2 }

export const EighteenThirtyTwoTileSet = new TileSet(
    {
        id: '1832:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1832:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, EighteenThirtyTwoTileCatalog]
)
export const EighteenThirtyTwoTiles = EighteenThirtyTwoTileSet.definitions

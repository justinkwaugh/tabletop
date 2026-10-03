import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace,
    type TileManifestEntry
} from '@tabletop/18xx'

const SharedTiles = [
    '5',
    '6',
    '7',
    '8',
    '9',
    '14',
    '15',
    '54',
    '57',
    '62',
    '63',
    '80',
    '81',
    '82',
    '83',
    '448',
    '544',
    '545',
    '546',
    '592',
    '593',
    '597',
    '611',
    '619'
]

const TitleTiles = new TileCatalog([
    {
        id: '1817:X00',
        printedNumber: 'X00',
        aliases: [],
        scope: '1817',
        face: createCityTileFace('yellow', [1, 3, 5], 30, 1, ['B'])
    },
    {
        id: '1817:X30',
        printedNumber: 'X30',
        aliases: [],
        scope: '1817',
        face: createCityTileFace('gray', [2, 3, 4, 5], 100, 4, ['NY'])
    }
])

export const EighteenSeventeenTileSet = new TileSet(
    {
        id: '1817:standard',
        entries: [
            ...SharedTiles.map<TileManifestEntry>((number) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count: 'unlimited'
            })),
            { id: 'X00', faceDefinitionIds: ['1817:X00'], count: 1 },
            { id: 'X30', faceDefinitionIds: ['1817:X30'], count: 'unlimited' }
        ]
    },
    [StandardTileCatalog, TitleTiles]
)
export const EighteenSeventeenTiles = EighteenSeventeenTileSet.definitions

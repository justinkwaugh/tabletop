import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace,
    type TileEdge
} from '@tabletop/18xx'
const cityTiles: readonly { number: string; edges: readonly TileEdge[] }[] = [
    { number: '291', edges: [0, 1] },
    { number: '292', edges: [0, 2] },
    { number: '293', edges: [0, 3] }
]
export const EighteenFortySixTileCatalog = new TileCatalog(
    cityTiles.map(({ number, edges }) => ({
        id: `1846:${number}`,
        printedNumber: number,
        aliases: [],
        scope: '1846',
        face: createCityTileFace('yellow', edges, 40, 1, ['Z'])
    }))
)
export const EighteenFortySixTileSet = new TileSet(
    {
        id: '1846:phase-I',
        entries: [
            ...Object.entries({ '5': 3, '6': 4, '57': 4 }).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...['7', '8', '9'].map((number) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count: 'unlimited' as const
            })),
            ...cityTiles.map(({ number }) => ({
                id: number,
                faceDefinitionIds: [`1846:${number}`],
                count: 1
            }))
        ]
    },
    [StandardTileCatalog, EighteenFortySixTileCatalog]
)

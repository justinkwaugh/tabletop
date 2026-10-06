import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace,
    createSeparateCitiesTileFace,
    type TileEdge
} from '@tabletop/18xx'
const cityTiles: readonly { number: string; edges: readonly TileEdge[] }[] = [
    { number: '291', edges: [0, 1] },
    { number: '292', edges: [0, 2] },
    { number: '293', edges: [0, 3] }
]
export const EighteenFortySixTileCatalog = new TileCatalog([
    ...cityTiles.map(({ number, edges }) => ({
        id: `1846:${number}`,
        printedNumber: number,
        aliases: [],
        scope: '1846',
        face: createCityTileFace('yellow', edges, 40, 1, ['Z'])
    })),
    ...(
        [
            ['294', [0, 1, 3, 4]],
            ['295', [0, 1, 2, 3]],
            ['296', [0, 2, 3, 4]]
        ] as const
    ).map(([number, edges]) => ({
        id: `1846:${number}`,
        printedNumber: number,
        aliases: [],
        scope: '1846',
        face: createCityTileFace('green', edges, 50, 2, ['Z'])
    })),
    ...(
        [
            ['297', 'brown', 60],
            ['290', 'gray', 70]
        ] as const
    ).map(([number, color, revenue]) => ({
        id: `1846:${number}`,
        printedNumber: number,
        aliases: [],
        scope: '1846',
        face: createCityTileFace(color, [0, 1, 2, 3, 4], revenue, 3, ['Z'])
    })),
    ...(
        [
            ['298', 'green', 40],
            ['299', 'brown', 70],
            ['300', 'gray', 90]
        ] as const
    ).map(([number, color, revenue]) => ({
        id: `1846:${number}`,
        printedNumber: number,
        aliases: [],
        scope: '1846',
        face: createSeparateCitiesTileFace(
            color,
            ([0, 3, 4, 5] as const).map((edge) => ({
                edges: [edge, 2],
                revenue,
                stationSlots: 1
            })),
            ['Chi']
        )
    }))
])
export const EighteenFortySixTileSet = new TileSet(
    {
        id: '1846',
        entries: [
            ...Object.entries({
                '5': 3,
                '6': 4,
                '57': 4,
                '14': 4,
                '15': 5,
                '16': 2,
                '17': 1,
                '18': 1,
                '19': 2,
                '20': 2,
                '21': 1,
                '22': 1,
                '23': 4,
                '24': 4,
                '25': 2,
                '26': 1,
                '27': 1,
                '28': 1,
                '29': 1,
                '30': 1,
                '31': 1,
                '619': 3,
                '39': 1,
                '40': 1,
                '41': 2,
                '42': 2,
                '43': 2,
                '44': 1,
                '45': 2,
                '46': 2,
                '47': 2,
                '70': 1,
                '611': 4,
                '51': 2
            }).map(([number, count]) => ({
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
            })),
            ...Object.entries({
                '290': 1,
                '294': 2,
                '295': 2,
                '296': 1,
                '297': 2,
                '298': 1,
                '299': 1,
                '300': 1
            }).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1846:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, EighteenFortySixTileCatalog]
)

import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace,
    type TileDefinition,
    type TileManifestEntry,
    type TileEdge
} from '@tabletop/18xx'

const SpecialTiles = new TileCatalog([
    cityTile('5X', 'yellow', [0, 1], 20, 1, ['X']),
    cityTile('6X', 'yellow', [0, 2], 20, 1, ['X']),
    cityTile('5T', 'yellow', [0, 1], 20, 1, ['T']),
    cityTile('6T', 'yellow', [0, 2], 20, 1, ['T']),
    cityTile('PEI1', 'green', [0, 1, 3, 4], 20, 2, []),
    cityTile('PEI2', 'green', [0, 1, 2, 3], 20, 2, []),
    cityTile('PEI3', 'green', [0, 2, 3, 4], 20, 2, []),
    cityTile('PEI4', 'green', [5, 0], 30, 1, ['T']),
    cityTile('PEI5', 'green', [3, 1, 5], 30, 2, ['X']),
    cityTile('PEI6', 'green', [2, 1, 5], 30, 2, ['X']),
    cityTile('PEI7', 'green', [2, 1, 0], 30, 2, ['X']),
    cityTile('PEI8', 'green', [2, 5, 0], 30, 2, ['X']),
    cityTile('PEI9', 'brown', [0, 1, 2, 3, 4], 40, 2, []),
    cityTile('PEI10', 'brown', [0, 1], 60, 1, ['T']),
    cityTile('PEI11', 'brown', [0, 1, 2, 3], 60, 2, ['X']),
    cityTile('PEI12', 'brown', [0, 1, 5, 3], 60, 2, ['X']),
    cityTile('PEI13', 'brown', [0, 1, 4, 3], 60, 2, ['X']),
    cityTile('PEI14', 'brown', [0, 1, 4, 5, 3], 50, 3, ['X']),
    cityTile('PEI15', 'gray', [1, 5, 4, 3, 2], 80, 3, ['CX']),
    cityTile('PEI16', 'gray', [1, 5, 4, 3, 2], 70, 3, ['X'])
])

const SharedTileCounts: Readonly<Record<string, TileManifestEntry['count']>> = {
    '1': 2,
    '3': 'unlimited',
    '5': 'unlimited',
    '6': 'unlimited',
    '7': 'unlimited',
    '8': 'unlimited',
    '9': 1,
    '16': 3,
    '17': 3,
    '21': 2,
    '22': 2,
    '25': 4,
    '28': 4,
    '29': 4,
    '30': 3,
    '31': 3,
    '39': 1,
    '40': 1,
    '41': 1,
    '42': 1,
    '43': 1,
    '44': 1,
    '45': 1,
    '46': 1,
    '47': 1,
    '56': 2,
    '58': 'unlimited',
    '70': 1,
    '143': 2,
    '144': 2,
    '624': 2,
    '625': 2,
    '626': 2,
    '627': 1,
    '628': 1,
    '629': 1,
    '630': 2,
    '631': 2,
    '632': 2,
    '633': 2,
    '767': 1,
    '769': 1
}

const SpecialTileCounts: Readonly<Record<string, TileManifestEntry['count']>> = {
    '5X': 'unlimited',
    '6X': 'unlimited',
    '5T': 'unlimited',
    '6T': 'unlimited',
    PEI1: 3,
    PEI2: 3,
    PEI3: 3,
    PEI4: 2,
    PEI5: 2,
    PEI6: 2,
    PEI7: 2,
    PEI8: 2,
    PEI9: 2,
    PEI10: 2,
    PEI11: 2,
    PEI12: 2,
    PEI13: 2,
    PEI14: 2,
    PEI15: 1,
    PEI16: 1
}

export const TheOldPrinceTileSet = new TileSet(
    {
        id: 'the-old-prince:prototype',
        entries: [
            ...Object.entries(SharedTileCounts).map<TileManifestEntry>(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(SpecialTileCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`the-old-prince:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, SpecialTiles]
)

export const TheOldPrinceTiles = TheOldPrinceTileSet.definitions

function cityTile(
    printedNumber: string,
    color: string,
    edges: readonly TileEdge[],
    revenue: number,
    stationSlots: number,
    labels: readonly string[]
): TileDefinition {
    return {
        id: `the-old-prince:${printedNumber}`,
        printedNumber,
        aliases: [],
        scope: 'The Old Prince 1871',
        face: createCityTileFace(color, edges, revenue, stationSlots, labels)
    }
}

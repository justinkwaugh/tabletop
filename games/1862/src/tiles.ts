import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as city,
    createTownTileFace as town,
    createTrackTileFace as track,
    type TileDefinition,
    type TileFace
} from '@tabletop/18xx'

/** The rulebook calls the third colour russet. */
export const TileColorOrder1862: readonly string[] = ['white', 'yellow', 'green', 'brown']

function tile(id: string, printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1862:${id}`, printedNumber, aliases: [], scope: '1862', face }
}

// Yellow plain track always carries a small station (§7.6.2); 8850–8852 are the only such tiles.
export const TileCatalog1862 = new TileCatalog([
    tile('8850', '8850', town('yellow', [[0, 5]], 20)),
    tile('8851', '8851', town('yellow', [[0, 4]], 20)),
    tile('8852', '8852', town('yellow', [[0, 3]], 20)),
    tile('201', '201', city('yellow', [0, 1], 30, 1, ['Y'])),
    tile('202', '202', city('yellow', [0, 2], 30, 1, ['Y'])),
    tile('621', '621', city('yellow', [0, 3], 30, 1, ['Y'])),
    tile('790', '790', city('yellow', [0, 1, 3, 4], 40, 2, ['N'])),
    tile('791', '791', city('green', [0, 1, 2, 3, 4], 60, 3, ['N'])),
    tile('792', '792', city('green', [0, 3, 5], 50, 2, ['Y'])),
    tile('793', '793', city('green', [0, 1, 3], 50, 2, ['Y'])),
    tile('53Y', '53', city('green', [0, 2, 4], 50, 2, ['Y'])),
    tile('794', '794', city('brown', [0, 1, 2, 3, 4, 5], 80, 4, ['N'])),
    tile('795', '795', city('brown', [0, 1, 2, 4, 5], 80, 4, ['I'])),
    tile('796', '796', city('brown', [0, 1, 3, 4], 60, 2, ['Y'])),
    tile('797', '797', city('brown', [0, 3, 4], 60, 2, ['H'])),
    tile('61Y', '61', city('brown', [0, 2, 3, 4], 60, 2, ['Y'])),
    tile('891Y', '891', city('brown', [0, 1, 2, 3], 60, 2, ['Y'])),
    tile(
        '778',
        '778',
        track('brown', [
            [0, 4],
            [1, 3],
            [2, 5]
        ])
    ),
    tile(
        '779',
        '779',
        track('brown', [
            [0, 4],
            [1, 5],
            [2, 3]
        ])
    ),
    tile(
        '780',
        '780',
        track('brown', [
            [0, 3],
            [1, 2],
            [4, 5]
        ])
    ),
    tile(
        '798',
        '798',
        track('brown', [
            [0, 3],
            [1, 4],
            [2, 5]
        ])
    )
])

const StandardCounts: Readonly<Record<string, number>> = {
    '5': 10,
    '6': 10,
    '57': 12,
    '14': 11,
    '15': 10,
    '619': 10,
    '16': 2,
    '17': 5,
    '18': 5,
    '19': 4,
    '20': 6,
    '21': 2,
    '22': 2,
    '611': 8
}

const TitleCounts: Readonly<Record<string, number>> = {
    '8850': 6,
    '8851': 8,
    '8852': 12,
    '201': 2,
    '202': 4,
    '621': 2,
    '790': 4,
    '791': 4,
    '792': 2,
    '793': 3,
    '53Y': 6,
    '794': 3,
    '795': 1,
    '796': 3,
    '797': 1,
    '61Y': 3,
    '891Y': 3,
    '778': 4,
    '779': 3,
    '780': 3,
    '798': 3
}

export const TileSet1862 = new TileSet(
    {
        id: '1862:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([id, count]) => ({
                id,
                faceDefinitionIds: [`1862:${id}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1862]
)
export const Tiles1862 = TileSet1862.definitions

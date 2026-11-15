import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as cityFace,
    createSeparateCitiesTileFace as citiesFace,
    createTownTileFace as townFace,
    sameStopCounts,
    type TileDefinition,
    type TileFace
} from '@tabletop/18xx'

// Kiev's green #635 costs R40 to upgrade to brown (§10.4); plain track is unlimited, as §10.4
// says to make more if it runs out.

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1861:${printedNumber}`, printedNumber, aliases: [], scope: '1861', face }
}

const AllEdges = [0, 1, 2, 3, 4, 5] as const

/** Labels of the cities with tiles of their own (§10.4). */
export const KievLabel = 'K'
export const MoscowLabel = 'M'
export const StPetersburgLabel = 'S'
export const KharkovLabel = 'Kh'

export const TileColorOrder1861: readonly string[] = ['white', 'yellow', 'green', 'brown', 'gray']

export const TileCatalog1861 = new TileCatalog([
    // Small cities: green and brown towns with four and five exits.
    titleTile('87', townFace('green', [[0, 1, 2, 3]], 10)),
    titleTile('88', townFace('green', [[0, 1, 3, 4]], 10)),
    titleTile('204', townFace('green', [[0, 2, 3, 4]], 10)),
    titleTile('911', townFace('brown', [[0, 1, 2, 3, 4]], 10)),
    // The Y cities.
    titleTile('201', cityFace('yellow', [0, 1], 30, 1, ['Y'])),
    titleTile('202', cityFace('yellow', [0, 2], 30, 1, ['Y'])),
    titleTile('621', cityFace('yellow', [0, 3], 30, 1, ['Y'])),
    titleTile('207', cityFace('green', [0, 1, 2, 3], 40, 2, ['Y'])),
    titleTile('208', cityFace('green', [0, 1, 3, 4], 40, 2, ['Y'])),
    titleTile('622', cityFace('green', [0, 2, 3, 4], 40, 2, ['Y'])),
    titleTile('623', cityFace('brown', AllEdges, 50, 2, ['Y'])),
    titleTile('801', cityFace('brown', [0, 1, 2, 3], 50, 2, ['Y'])),
    // Kiev: three stations in green, joined into one city in brown.
    titleTile('635', {
        ...citiesFace(
            'green',
            [
                { edges: [0, 1], revenue: 40, stationSlots: 1 },
                { edges: [2, 3], revenue: 40, stationSlots: 1 },
                { edges: [4, 5], revenue: 40, stationSlots: 1 }
            ],
            [KievLabel]
        ),
        upgradeCost: 40
    }),
    titleTile('636', cityFace('brown', AllEdges, 50, 3, [KievLabel])),
    // Moscow: three stations in green, one city from brown.
    titleTile(
        '637',
        citiesFace(
            'green',
            [
                { edges: [0, 1], revenue: 50, stationSlots: 1 },
                { edges: [2, 3], revenue: 50, stationSlots: 1 },
                { edges: [4, 5], revenue: 50, stationSlots: 1 }
            ],
            [MoscowLabel]
        )
    ),
    titleTile('638', cityFace('brown', AllEdges, 70, 3, [MoscowLabel])),
    titleTile('639', cityFace('gray', AllEdges, 100, 4, [MoscowLabel])),
    // Kharkov's grey tile.
    titleTile('640', cityFace('gray', AllEdges, 60, 3, [KharkovLabel])),
    // St. Petersburg, printed green with two stations, one city from brown.
    titleTile('641', cityFace('brown', [0, 1, 5], 50, 3, [StPetersburgLabel])),
    titleTile('642', cityFace('gray', [0, 1, 5], 70, 3, [StPetersburgLabel]))
])

/**
 * Kiev's, Moscow's and St. Petersburg's separate stations join into one city in brown (§10.4);
 * every other upgrade keeps its stops.
 */
export function preservesStops1861(before: TileFace, after: TileFace): boolean {
    return (
        sameStopCounts(before, after) ||
        (after.color === 'brown' &&
            [KievLabel, MoscowLabel, StPetersburgLabel].some(
                (label) => before.labels.includes(label) && after.labels.includes(label)
            ))
    )
}

/** The Moscow grey tile, which brings the RSR's Moscow station (§7.4). */
export const MoscowGreyTileId = '1861:639'

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
    '15': 2,
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
    '635': 1,
    '636': 1,
    '637': 1,
    '638': 1,
    '639': 1,
    '640': 1,
    '641': 1,
    '642': 1
}

export const TileSet1861 = new TileSet(
    {
        id: '1861:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1861:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1861]
)
export const Tiles1861 = TileSet1861.definitions

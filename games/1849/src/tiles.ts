import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    type TileDefinition,
    type TileFace
} from '@tabletop/18xx'
import { Dual, Narrow, cityFace, townFace, trackFace } from './faces.js'

export const TileColorOrder1849: readonly string[] = ['white', 'yellow', 'green', 'brown']

function tile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1849:${printedNumber}`, printedNumber, aliases: [], scope: '1849', face }
}

// The tiles with narrow or dual gauge track, and the large cities' own tiles: P Palermo, C Catania,
// M Messina and S Siracusa (§10.3). Every other tile of the manifest is a standard one.
export const TileCatalog1849 = new TileCatalog([
    tile(
        '73',
        townFace(
            'yellow',
            [
                [0, Narrow],
                [2, Narrow]
            ],
            10
        )
    ),
    tile(
        '74',
        townFace(
            'yellow',
            [
                [0, Narrow],
                [3, Narrow]
            ],
            10
        )
    ),
    tile('77', trackFace('yellow', [[0, 1, Narrow]])),
    tile('78', trackFace('yellow', [[0, 2, Narrow]])),
    tile('79', trackFace('yellow', [[0, 3, Narrow]])),
    tile('644', cityFace('yellow', [[0, Narrow], 1], 20, 1)),
    tile('645', cityFace('yellow', [[0, Narrow], 2], 20, 1)),
    tile('657', cityFace('yellow', [[0, Narrow], 3], 20, 1)),
    tile('658', cityFace('yellow', [0, [2, Narrow]], 20, 1)),
    tile('659', cityFace('yellow', [0, [1, Narrow]], 20, 1)),
    tile(
        '679',
        townFace(
            'yellow',
            [
                [0, Narrow],
                [1, Narrow]
            ],
            10
        )
    ),
    tile(
        '650',
        trackFace('green', [
            [0, 1, Narrow],
            [1, 2, Narrow]
        ])
    ),
    tile('651', cityFace('green', [0, [1, Narrow], [2, Narrow], 3, 4], 90, 2, ['P'])),
    tile('653', cityFace('green', [0, [1, Narrow], 3], 60, 2, ['C'])),
    tile('655', cityFace('green', [0, 2, 4], 50, 2, ['M'])),
    tile('660', cityFace('green', [0, [1, Narrow], 3, [4, Narrow]], 30, 2)),
    tile('661', cityFace('green', [[0, Narrow], 1, [3, Narrow], 4], 30, 2)),
    tile('662', cityFace('green', [[0, Narrow], [1, Narrow], 3, 4], 30, 2)),
    tile('663', cityFace('green', [[0, Narrow], 1, 3, [4, Narrow]], 30, 2)),
    tile('664', cityFace('green', [0, [1, Narrow], [2, Narrow], 3], 30, 2)),
    tile('665', cityFace('green', [[0, Narrow], 1, 2, [3, Narrow]], 30, 2)),
    tile('666', cityFace('green', [0, [1, Narrow], 2, [3, Narrow]], 30, 2)),
    tile('667', cityFace('green', [0, 1, [2, Narrow], [3, Narrow]], 30, 2)),
    tile('668', cityFace('green', [0, [2, Narrow], 3, [4, Narrow]], 30, 2)),
    tile('669', cityFace('green', [[0, Narrow], 2, [3, Narrow], 4], 30, 2)),
    tile('670', cityFace('green', [[0, Narrow], 2, 3, [4, Narrow]], 30, 2)),
    tile('671', cityFace('green', [[0, Narrow], [2, Narrow], 3, 4], 30, 2)),
    tile('675', cityFace('green', [0, [1, Narrow], 2], 20, 1, ['S'])),
    tile(
        '677',
        trackFace('green', [
            [0, 3, Narrow],
            [0, 4, Narrow]
        ])
    ),
    tile(
        '678',
        trackFace('green', [
            [0, 3, Narrow],
            [0, 2, Narrow]
        ])
    ),
    tile('680', townFace('green', [[0, Narrow], [1, Narrow], 2, 3], 10)),
    tile('681', townFace('green', [[0, Narrow], 1, [2, Narrow], 3], 10)),
    tile('682', townFace('green', [[0, Narrow], 1, 2, [3, Narrow]], 10)),
    tile('683', townFace('green', [0, [1, Narrow], [2, Narrow], 3], 10)),
    tile('684', townFace('green', [[0, Narrow], [2, Narrow], 3, 4], 10)),
    tile('685', townFace('green', [[0, Narrow], 2, 3, [4, Narrow]], 10)),
    tile('686', townFace('green', [[0, Narrow], 2, [3, Narrow], 4], 10)),
    tile('687', townFace('green', [0, [2, Narrow], 3, [4, Narrow]], 10)),
    tile('688', townFace('green', [[0, Narrow], 1, 3, [4, Narrow]], 10)),
    tile('689', townFace('green', [[0, Narrow], [1, Narrow], 3, 4], 10)),
    tile('690', townFace('green', [0, [1, Narrow], 3, [4, Narrow]], 10)),
    tile('691', townFace('green', [[0, Narrow], 1, [3, Narrow], 4], 10)),
    tile(
        '692',
        trackFace('green', [
            [0, 3, Narrow],
            [0, 5, Narrow]
        ])
    ),
    tile(
        '693',
        trackFace('green', [
            [0, 3, Narrow],
            [0, 1, Narrow]
        ])
    ),
    tile(
        '694',
        trackFace('green', [
            [0, 4, Narrow],
            [0, 5, Narrow]
        ])
    ),
    tile(
        '695',
        trackFace('green', [
            [0, 2, Narrow],
            [0, 1, Narrow]
        ])
    ),
    tile(
        '699',
        trackFace('green', [
            [0, 2, Narrow],
            [0, 4, Narrow]
        ])
    ),
    tile('700', townFace('green', [0, [1, Narrow], 2, [3, Narrow]], 10)),
    tile('701', townFace('green', [0, 1, [2, Narrow], [3, Narrow]], 10)),
    tile('702', townFace('green', [0, [2, Narrow], [3, Narrow], 4], 10)),
    tile('703', townFace('green', [0, 2, [3, Narrow], [4, Narrow]], 10)),
    tile('704', cityFace('green', [0, 2, [3, Narrow], [4, Narrow]], 30, 2)),
    tile('705', cityFace('green', [0, [2, Narrow], [3, Narrow], 4], 30, 2)),
    tile('706', cityFace('green', [[0, Narrow], [1, Narrow], 2, 3], 30, 2)),
    tile('707', cityFace('green', [[0, Narrow], 1, [2, Narrow], 3], 30, 2)),
    tile(
        '708',
        trackFace('green', [
            [0, 4, Narrow],
            [0, 1, Narrow]
        ])
    ),
    tile(
        '709',
        trackFace('green', [
            [0, 2, Narrow],
            [0, 5, Narrow]
        ])
    ),
    tile(
        '710',
        trackFace('green', [
            [0, 2, Narrow],
            [1, 3]
        ])
    ),
    tile(
        '711',
        trackFace('green', [
            [0, 3, Narrow],
            [2, 4]
        ])
    ),
    tile(
        '712',
        trackFace('green', [
            [0, 2],
            [1, 3, Narrow]
        ])
    ),
    tile(
        '713',
        trackFace('green', [
            [0, 3],
            [2, 4, Narrow]
        ])
    ),
    tile(
        '714',
        trackFace('green', [
            [0, 3],
            [1, 4, Narrow]
        ])
    ),
    tile(
        '715',
        trackFace('green', [
            [0, 3, Narrow],
            [1, 4]
        ])
    ),
    tile(
        '646',
        trackFace('brown', [
            [0, 2, Narrow],
            [2, 4, Narrow],
            [0, 4, Narrow]
        ])
    ),
    tile(
        '647',
        trackFace('brown', [
            [0, 2, Narrow],
            [0, 1, Narrow],
            [1, 2, Narrow]
        ])
    ),
    tile(
        '648',
        trackFace('brown', [
            [0, 3, Narrow],
            [0, 1, Narrow],
            [1, 3, Narrow]
        ])
    ),
    tile(
        '649',
        trackFace('brown', [
            [0, 3, Narrow],
            [3, 5, Narrow],
            [0, 5, Narrow]
        ])
    ),
    tile('652', cityFace('brown', [[0, Dual], [1, Dual], [2, Dual], [3, Dual], 4], 130, 2, ['P'])),
    tile('654', cityFace('brown', [0, [2, Dual], 3, [4, Dual]], 90, 2, ['C'])),
    tile('656', cityFace('brown', [[0, Dual], 2, [3, Narrow], 4], 80, 2, ['M'])),
    tile(
        '672',
        cityFace(
            'brown',
            [
                [0, Dual],
                [1, Dual],
                [3, Dual],
                [4, Dual]
            ],
            40,
            2
        )
    ),
    tile(
        '673',
        cityFace(
            'brown',
            [
                [0, Dual],
                [1, Dual],
                [2, Dual],
                [3, Dual]
            ],
            40,
            2
        )
    ),
    tile(
        '674',
        cityFace(
            'brown',
            [
                [0, Dual],
                [2, Dual],
                [3, Dual],
                [4, Dual]
            ],
            40,
            2
        )
    ),
    tile('676', cityFace('brown', [[0, Dual], [1, Dual], 2], 30, 2, ['S'])),
    tile(
        '696',
        townFace(
            'brown',
            [
                [0, Dual],
                [1, Dual],
                [3, Dual],
                [4, Dual]
            ],
            20
        )
    ),
    tile(
        '697',
        townFace(
            'brown',
            [
                [0, Dual],
                [1, Dual],
                [2, Dual],
                [3, Dual]
            ],
            20
        )
    ),
    tile(
        '698',
        townFace(
            'brown',
            [
                [0, Dual],
                [2, Dual],
                [3, Dual],
                [4, Dual]
            ],
            20
        )
    )
])

// The tile manifest (p. 19): 72 yellow, 72 green and 24 brown tiles.
const StandardCounts: Readonly<Record<string, number>> = {
    '3': 4,
    '4': 4,
    '7': 4,
    '8': 10,
    '9': 6,
    '58': 4,
    '23': 3,
    '24': 3,
    '25': 2,
    '26': 1,
    '27': 1,
    '28': 1,
    '29': 1,
    '30': 1,
    '31': 1,
    '624': 1,
    '39': 1,
    '40': 1,
    '41': 1,
    '42': 1
}
const TitleCounts: Readonly<Record<string, number>> = {
    '73': 4,
    '74': 3,
    '77': 4,
    '78': 10,
    '79': 7,
    '644': 2,
    '645': 2,
    '657': 2,
    '658': 2,
    '659': 2,
    '679': 2,
    '650': 1,
    '651': 1,
    '653': 1,
    '655': 1,
    '660': 1,
    '661': 1,
    '662': 1,
    '663': 1,
    '664': 1,
    '665': 1,
    '666': 1,
    '667': 1,
    '668': 1,
    '669': 1,
    '670': 1,
    '671': 1,
    '675': 1,
    '677': 3,
    '678': 3,
    '680': 1,
    '681': 1,
    '682': 1,
    '683': 1,
    '684': 1,
    '685': 1,
    '686': 1,
    '687': 1,
    '688': 1,
    '689': 1,
    '690': 1,
    '691': 1,
    '692': 1,
    '693': 1,
    '694': 1,
    '695': 1,
    '699': 2,
    '700': 1,
    '701': 1,
    '702': 1,
    '703': 1,
    '704': 1,
    '705': 1,
    '706': 1,
    '707': 1,
    '708': 1,
    '709': 1,
    '710': 1,
    '711': 1,
    '712': 1,
    '713': 1,
    '714': 1,
    '715': 1,
    '646': 1,
    '647': 1,
    '648': 1,
    '649': 1,
    '652': 1,
    '654': 1,
    '656': 1,
    '672': 1,
    '673': 2,
    '674': 2,
    '676': 1,
    '696': 3,
    '697': 2,
    '698': 2
}

export const TileSet1849 = new TileSet(
    {
        id: '1849:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1849:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1849]
)
export const Tiles1849 = TileSet1849.definitions

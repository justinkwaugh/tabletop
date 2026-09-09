import { TileCatalog } from './catalog.js'
import {
    createCityTileFace as cityFace,
    createTownTileFace as townFace,
    createTrackTileFace as trackFace
} from './faces.js'
import type { TileDefinition, TileEdge, TileFace, TilePath } from './tile.js'

export const StandardTileCatalog = new TileCatalog([
    standardTile(
        '1',
        townFace(
            'yellow',
            [
                [1, 3],
                [0, 4]
            ],
            10
        )
    ),
    standardTile('3', {
        color: 'yellow',
        nodes: [{ id: 'town', kind: 'town', revenue: { kind: 'fixed', amount: 10 } }],
        paths: pathsToNode([0, 1], 'town'),
        labels: []
    }),
    standardTile('5', cityFace('yellow', [0, 1], 20, 1)),
    standardTile('6', cityFace('yellow', [0, 2], 20, 1)),
    standardTile('7', trackFace('yellow', [[0, 1]])),
    standardTile('8', trackFace('yellow', [[0, 2]])),
    standardTile('9', trackFace('yellow', [[0, 3]])),
    standardTile('12', cityFace('green', [0, 1, 2], 30, 1)),
    standardTile('13', cityFace('green', [0, 2, 4], 30, 1)),
    standardTile('14', cityFace('green', [0, 1, 3, 4], 30, 2)),
    standardTile('15', cityFace('green', [0, 1, 2, 3], 30, 2)),
    standardTile(
        '16',
        trackFace('green', [
            [0, 2],
            [1, 3]
        ])
    ),
    standardTile(
        '17',
        trackFace('green', [
            [1, 3],
            [0, 4]
        ])
    ),
    standardTile(
        '19',
        trackFace('green', [
            [0, 3],
            [2, 4]
        ])
    ),
    standardTile(
        '20',
        trackFace('green', [
            [0, 3],
            [1, 4]
        ])
    ),
    standardTile(
        '21',
        trackFace('green', [
            [0, 2],
            [3, 4]
        ])
    ),
    standardTile(
        '22',
        trackFace('green', [
            [0, 4],
            [2, 3]
        ])
    ),
    standardTile(
        '23',
        trackFace('green', [
            [0, 3],
            [0, 4]
        ])
    ),
    standardTile(
        '24',
        trackFace('green', [
            [0, 3],
            [0, 2]
        ])
    ),
    standardTile(
        '25',
        trackFace('green', [
            [0, 2],
            [0, 4]
        ])
    ),
    standardTile(
        '26',
        trackFace('green', [
            [0, 3],
            [0, 5]
        ])
    ),
    standardTile(
        '27',
        trackFace('green', [
            [0, 3],
            [0, 1]
        ])
    ),
    standardTile(
        '28',
        trackFace('green', [
            [0, 4],
            [0, 5]
        ])
    ),
    standardTile(
        '29',
        trackFace('green', [
            [0, 2],
            [0, 1]
        ])
    ),
    standardTile(
        '30',
        trackFace('green', [
            [0, 4],
            [0, 1]
        ])
    ),
    standardTile(
        '31',
        trackFace('green', [
            [0, 2],
            [0, 5]
        ])
    ),
    standardTile(
        '39',
        trackFace('brown', [
            [0, 2],
            [0, 1],
            [1, 2]
        ])
    ),
    standardTile(
        '40',
        trackFace('brown', [
            [0, 2],
            [2, 4],
            [0, 4]
        ])
    ),
    standardTile(
        '41',
        trackFace('brown', [
            [0, 3],
            [0, 1],
            [1, 3]
        ])
    ),
    standardTile(
        '42',
        trackFace('brown', [
            [0, 3],
            [3, 5],
            [0, 5]
        ])
    ),
    standardTile(
        '43',
        trackFace('brown', [
            [0, 3],
            [0, 2],
            [1, 3],
            [1, 2]
        ])
    ),
    standardTile(
        '44',
        trackFace('brown', [
            [0, 3],
            [1, 4],
            [0, 1],
            [3, 4]
        ])
    ),
    standardTile(
        '45',
        trackFace('brown', [
            [0, 3],
            [2, 4],
            [0, 4],
            [2, 3]
        ])
    ),
    standardTile(
        '46',
        trackFace('brown', [
            [0, 3],
            [2, 4],
            [3, 4],
            [0, 2]
        ])
    ),
    standardTile(
        '47',
        trackFace('brown', [
            [0, 3],
            [1, 4],
            [1, 3],
            [0, 4]
        ])
    ),
    standardTile(
        '56',
        townFace(
            'yellow',
            [
                [0, 2],
                [1, 3]
            ],
            10
        )
    ),
    standardTile('57', cityFace('yellow', [0, 3], 20, 1)),
    standardTile('58', townFace('yellow', [[0, 2]], 10)),
    standardTile(
        '70',
        trackFace('brown', [
            [0, 1],
            [0, 2],
            [1, 3],
            [2, 3]
        ])
    ),
    standardTile('81', {
        color: 'green',
        nodes: [{ id: 'junction', kind: 'junction' }],
        paths: pathsToNode([0, 2, 4], 'junction'),
        labels: []
    }),
    standardTile('143', townFace('green', [[0, 1, 2]], 10)),
    standardTile('144', townFace('green', [[0, 2, 4]], 10)),
    standardTile('205', cityFace('green', [0, 1, 3], 30, 1)),
    standardTile('206', cityFace('green', [0, 5, 3], 30, 1)),
    standardTile('437', { ...townFace('yellow', [[0, 2]], 30), symbols: ['port'] }),
    standardTile('438', { ...cityFace('yellow', [0, 2], 40, 1, ['H']), upgradeCost: 80 }),
    standardTile('439', { ...cityFace('green', [0, 2, 4], 60, 2, ['H']), upgradeCost: 80 }),
    standardTile('440', cityFace('green', [0, 1, 2], 40, 2, ['T'])),
    standardTile('448', cityFace('brown', [0, 1, 2, 3], 40, 2)),
    standardTile('465', cityFace('brown', [0, 1, 2, 3], 60, 3, ['K'])),
    standardTile('466', cityFace('brown', [0, 1, 2], 60, 2, ['T'])),
    standardTile('492', cityFace('brown', [0, 1, 2, 3, 4, 5], 80, 3, ['H'])),
    standardTile('611', cityFace('brown', [0, 1, 2, 3, 4], 40, 2)),
    standardTile(
        '624',
        trackFace('green', [
            [0, 1],
            [1, 2]
        ])
    ),
    standardTile(
        '625',
        trackFace('green', [
            [0, 1],
            [2, 3]
        ])
    ),
    standardTile(
        '626',
        trackFace('green', [
            [0, 1],
            [3, 4]
        ])
    ),
    standardTile(
        '627',
        trackFace('brown', [
            [0, 3],
            [0, 1],
            [1, 2],
            [2, 3]
        ])
    ),
    standardTile(
        '628',
        trackFace('brown', [
            [1, 3],
            [3, 4],
            [0, 4],
            [0, 1]
        ])
    ),
    standardTile(
        '629',
        trackFace('brown', [
            [0, 2],
            [2, 3],
            [3, 4],
            [0, 4]
        ])
    ),
    standardTile(
        '630',
        townFace(
            'yellow',
            [
                [2, 3],
                [0, 4]
            ],
            10
        )
    ),
    standardTile(
        '631',
        townFace(
            'yellow',
            [
                [3, 4],
                [0, 2]
            ],
            10
        )
    ),
    standardTile(
        '632',
        townFace(
            'yellow',
            [
                [0, 1],
                [2, 3]
            ],
            10
        )
    ),
    standardTile(
        '633',
        townFace(
            'yellow',
            [
                [0, 1],
                [3, 4]
            ],
            10
        )
    ),
    standardTile('767', townFace('brown', [[2, 3, 4, 5]], 10)),
    standardTile('769', townFace('brown', [[0, 2, 3, 4]], 10))
])

function standardTile(printedNumber: string, face: TileFace): TileDefinition {
    return {
        id: `18xx:${printedNumber}`,
        printedNumber,
        aliases: [],
        scope: 'Shared 18xx',
        face
    }
}

function pathsToNode(edges: readonly TileEdge[], nodeId: string): TilePath[] {
    return edges.map((edge) => ({
        id: `edge-${edge}`,
        endpoints: [
            { kind: 'edge', edge },
            { kind: 'node', nodeId }
        ]
    }))
}

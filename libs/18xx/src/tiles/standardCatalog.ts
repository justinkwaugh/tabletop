import { TileCatalog } from './catalog.js'
import type { TileDefinition, TileEdge, TileFace, TilePath } from './tile.js'

export const StandardTileCatalog = new TileCatalog([
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
    standardTile('14', cityFace('green', [0, 1, 3, 4], 30, 2)),
    standardTile(
        '16',
        trackFace('green', [
            [0, 2],
            [1, 3]
        ])
    ),
    standardTile('81', {
        color: 'green',
        nodes: [{ id: 'junction', kind: 'junction' }],
        paths: pathsToNode([0, 2, 4], 'junction'),
        labels: []
    }),
    standardTile('611', cityFace('brown', [0, 1, 2, 3, 4], 40, 2))
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

function trackFace(
    color: string,
    connections: readonly (readonly [TileEdge, TileEdge])[]
): TileFace {
    return {
        color,
        nodes: [],
        paths: connections.map(([a, b], index) => ({
            id: `path-${index}`,
            endpoints: [
                { kind: 'edge', edge: a },
                { kind: 'edge', edge: b }
            ]
        })),
        labels: []
    }
}

function cityFace(
    color: string,
    edges: readonly TileEdge[],
    revenue: number,
    stationSlots: number
): TileFace {
    return {
        color,
        nodes: [
            { id: 'city', kind: 'city', revenue: { kind: 'fixed', amount: revenue }, stationSlots }
        ],
        paths: pathsToNode(edges, 'city'),
        labels: []
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

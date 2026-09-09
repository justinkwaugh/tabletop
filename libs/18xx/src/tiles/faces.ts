import type { TileEdge, TileFace } from './tile.js'

export function createTrackTileFace(
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

export function createCityTileFace(
    color: string,
    edges: readonly TileEdge[],
    revenue: number,
    stationSlots: number,
    labels: readonly string[] = []
): TileFace {
    return {
        color,
        nodes: [
            { id: 'city', kind: 'city', stationSlots, revenue: { kind: 'fixed', amount: revenue } }
        ],
        paths: edges.map((edge) => ({
            id: `edge-${edge}`,
            endpoints: [
                { kind: 'edge', edge },
                { kind: 'node', nodeId: 'city' }
            ]
        })),
        labels
    }
}

export function createTownTileFace(
    color: string,
    connections: readonly (readonly TileEdge[])[],
    revenue: number
): TileFace {
    const townIds = connections.map((_, index) =>
        connections.length === 1 ? 'town' : `town-${index}`
    )
    return {
        color,
        nodes: townIds.map((id) => ({
            id,
            kind: 'town',
            revenue: { kind: 'fixed', amount: revenue }
        })),
        paths: connections.flatMap((edges, index) =>
            edges.map((edge) => ({
                id: `${townIds[index]}-edge-${edge}`,
                endpoints: [
                    { kind: 'edge', edge },
                    { kind: 'node', nodeId: townIds[index] }
                ]
            }))
        ),
        labels: []
    }
}

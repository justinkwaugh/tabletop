import type { TileEdge, TileFace, TileRevenue } from './tile.js'

export function createStagedTileRevenue(
    values: readonly (readonly [string, number])[]
): TileRevenue {
    return { kind: 'staged', values: values.map(([stage, amount]) => ({ stage, amount })) }
}

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
    revenue: number | TileRevenue,
    stationSlots: number,
    labels: readonly string[] = []
): TileFace {
    return {
        color,
        nodes: [
            {
                id: 'city',
                kind: 'city',
                stationSlots,
                revenue: typeof revenue === 'number' ? { kind: 'fixed', amount: revenue } : revenue
            }
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

export type SeparateCity = {
    edges: readonly TileEdge[]
    revenue: number | TileRevenue
    stationSlots: number
}

/** A face whose cities are separate stops, identified as ``city-0``, ``city-1`` and so on. */
export function createSeparateCitiesTileFace(
    color: string,
    cities: readonly SeparateCity[],
    labels: readonly string[] = []
): TileFace {
    return {
        color,
        nodes: cities.map((city, index) => ({
            id: `city-${index}`,
            kind: 'city',
            stationSlots: city.stationSlots,
            revenue:
                typeof city.revenue === 'number'
                    ? { kind: 'fixed', amount: city.revenue }
                    : city.revenue
        })),
        paths: cities.flatMap((city, index) =>
            city.edges.map((edge) => ({
                id: `city-${index}-edge-${edge}`,
                endpoints: [
                    { kind: 'edge', edge },
                    { kind: 'node', nodeId: `city-${index}` }
                ]
            }))
        ),
        labels
    }
}

export function createOffboardTileFace(edges: readonly TileEdge[], revenue: TileRevenue): TileFace {
    return {
        color: 'red',
        labels: [],
        nodes: [{ id: 'offboard', kind: 'offboard', revenue }],
        paths: edges.map((edge) => ({
            id: `edge-${edge}`,
            endpoints: [
                { kind: 'edge', edge },
                { kind: 'node', nodeId: 'offboard' }
            ]
        }))
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

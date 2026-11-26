import { FlatHexDirection, HexOrientation, PointyHexDirection } from '@tabletop/common'
import type {
    TileEdge,
    TileEdgeEndpoint,
    TileEndpoint,
    TileFace,
    TilePath,
    TileRotation
} from './tile.js'

export const TileEdges: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]
const FlatDirections: Record<TileEdge, FlatHexDirection> = {
    0: FlatHexDirection.South,
    1: FlatHexDirection.Southwest,
    2: FlatHexDirection.Northwest,
    3: FlatHexDirection.North,
    4: FlatHexDirection.Northeast,
    5: FlatHexDirection.Southeast
}
const PointyDirections: Record<TileEdge, PointyHexDirection> = {
    0: PointyHexDirection.Southwest,
    1: PointyHexDirection.West,
    2: PointyHexDirection.Northwest,
    3: PointyHexDirection.Northeast,
    4: PointyHexDirection.East,
    5: PointyHexDirection.Southeast
}

export function tileEdgeDirection(
    edge: TileEdge,
    orientation: HexOrientation.Flat
): FlatHexDirection
export function tileEdgeDirection(
    edge: TileEdge,
    orientation: HexOrientation.Pointy
): PointyHexDirection
export function tileEdgeDirection(
    edge: TileEdge,
    orientation: HexOrientation
): FlatHexDirection | PointyHexDirection
export function tileEdgeDirection(
    edge: TileEdge,
    orientation: HexOrientation
): FlatHexDirection | PointyHexDirection {
    return orientation === HexOrientation.Flat ? FlatDirections[edge] : PointyDirections[edge]
}

export function rotateTileEdge(edge: TileEdge, rotation: TileRotation): TileEdge {
    return TileEdges[(edge + rotation) % 6]
}

export function rotateTileFace(face: TileFace, rotation: TileRotation): TileFace {
    return {
        ...face,
        paths: face.paths.map((path) => ({
            ...path,
            endpoints: [
                rotateTileEndpoint(path.endpoints[0], rotation),
                rotateTileEndpoint(path.endpoints[1], rotation)
            ]
        }))
    }
}

export function sameTileEndpoint(a: TileEndpoint, b: TileEndpoint): boolean {
    return a.kind === 'edge'
        ? b.kind === 'edge' && a.edge === b.edge && tileEdgeLane(a) === tileEdgeLane(b)
        : b.kind === 'node' && a.nodeId === b.nodeId
}

/** Which parallel track of its hex side an edge endpoint is; the first, 0, unless it names one. */
export function tileEdgeLane(endpoint: TileEdgeEndpoint): number {
    return endpoint.lane ?? 0
}

/** Names an edge endpoint's track among its hex's: the side, and which parallel track of it. */
export function tileEdgeKey(endpoint: TileEdgeEndpoint): string {
    return `${endpoint.edge}/${tileEdgeLane(endpoint)}`
}

/** The endpoint across a hex side that an edge endpoint's track meets: the same lane there. */
export function oppositeTileEndpoint(endpoint: TileEdgeEndpoint, edge: TileEdge): TileEdgeEndpoint {
    return { ...endpoint, edge }
}

/** The stop a terminus path ends routes at, where the path is one. */
export function terminusNodeId(path: TilePath): string | undefined {
    if (!path.terminus) return undefined
    const [node] = path.endpoints.flatMap((end) => (end.kind === 'node' ? [end.nodeId] : []))
    return node
}

/** Whether some track of the face runs to the edge. */
export function faceRunsToEdge(face: TileFace, edge: TileEdge): boolean {
    return face.paths.some((path) =>
        path.endpoints.some((end) => end.kind === 'edge' && end.edge === edge)
    )
}

export function tilePathsAtEndpoint(face: TileFace, endpoint: TileEndpoint): readonly TilePath[] {
    return face.paths.filter((path) =>
        path.endpoints.some((end) => sameTileEndpoint(end, endpoint))
    )
}

function rotateTileEndpoint(endpoint: TileEndpoint, rotation: TileRotation): TileEndpoint {
    return endpoint.kind === 'edge'
        ? { ...endpoint, edge: rotateTileEdge(endpoint.edge, rotation) }
        : endpoint
}

import { FlatHexDirection, HexOrientation, PointyHexDirection } from '@tabletop/common'
import type { TileEdge, TileEndpoint, TileFace, TilePath, TileRotation } from './tile.js'

const Edges: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]
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
    return Edges[(edge + rotation) % 6]
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
        ? b.kind === 'edge' && a.edge === b.edge
        : b.kind === 'node' && a.nodeId === b.nodeId
}

export function tilePathsAtEndpoint(face: TileFace, endpoint: TileEndpoint): readonly TilePath[] {
    return face.paths.filter((path) =>
        path.endpoints.some((end) => sameTileEndpoint(end, endpoint))
    )
}

function rotateTileEndpoint(endpoint: TileEndpoint, rotation: TileRotation): TileEndpoint {
    return endpoint.kind === 'edge'
        ? { kind: 'edge', edge: rotateTileEdge(endpoint.edge, rotation) }
        : endpoint
}

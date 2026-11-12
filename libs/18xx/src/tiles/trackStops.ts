import * as Type from 'typebox'
import { TileEdge, type TileFace, type TileNode, type TilePath, type TileRotation } from './tile.js'
import { rotateTileEdge } from './topology.js'

/**
 * A town standing on a line of plain track of a laid tile, owned by nobody, such as 1862's small
 * stations. Its line runs between two map edges, given as the map sees them, so the stop keeps
 * its place when an upgrade turns the tile.
 */
export const TrackStop = Type.Object(
    {
        edges: Type.Tuple([TileEdge, TileEdge]),
        revenue: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type TrackStop = Type.Static<typeof TrackStop>

export function trackStopNodeId([a, b]: readonly [TileEdge, TileEdge]): string {
    return `track-stop-${Math.min(a, b)}-${Math.max(a, b)}`
}

/** The line of a path joining two edges with nothing between them. */
function plainLine(path: TilePath): [TileEdge, TileEdge] | undefined {
    const [a, b] = path.endpoints
    return a.kind === 'edge' && b.kind === 'edge' ? [a.edge, b.edge] : undefined
}

function sameLine(a: readonly TileEdge[], b: readonly TileEdge[]): boolean {
    return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
}

/**
 * The face with each stop standing on its line: the plain path between the stop's edges becomes
 * a town joined to both. ``rotation`` is the tile's, so stops given as the map sees them are
 * turned back onto the unrotated face.
 */
export function withTrackStops(
    face: TileFace,
    stops: readonly TrackStop[] | undefined,
    rotation: TileRotation = 0
): TileFace {
    if (!stops?.length) return face
    const unturn = (edge: TileEdge) => rotateTileEdge(edge, ((6 - rotation) % 6) as TileRotation)
    const nodes: TileNode[] = [...face.nodes]
    const paths: TilePath[] = []
    const placed = new Set<TrackStop>()
    for (const path of face.paths) {
        const line = plainLine(path)
        const stop =
            line &&
            stops.find(
                (candidate) =>
                    !placed.has(candidate) &&
                    sameLine(line, [unturn(candidate.edges[0]), unturn(candidate.edges[1])])
            )
        if (!line || !stop) {
            paths.push(path)
            continue
        }
        placed.add(stop)
        const nodeId = trackStopNodeId(stop.edges)
        nodes.push({ id: nodeId, kind: 'town', revenue: { kind: 'fixed', amount: stop.revenue } })
        for (const edge of line)
            paths.push({
                id: `${path.id}-${edge}`,
                endpoints: [
                    { kind: 'edge', edge },
                    { kind: 'node', nodeId }
                ],
                ...(path.gauge ? { gauge: path.gauge } : {})
            })
    }
    if (placed.size !== stops.length) throw new Error('A track stop needs plain track on its line')
    return { ...face, nodes, paths }
}

/** The plain lines of a turned face that could take a stop, as the map sees them. */
export function openTrackStopLines(face: TileFace): [TileEdge, TileEdge][] {
    if (face.nodes.some((node) => node.kind === 'city' || node.kind === 'offboard')) return []
    return face.paths.flatMap((path) => {
        const line = plainLine(path)
        return line ? [line] : []
    })
}

/**
 * The towns of a turned face that stand alone on a line between two edges, with that line: what
 * carries onto a replacing tile as a track stop.
 */
function townsOnLines(face: TileFace): TrackStop[] {
    return face.nodes.flatMap((node) => {
        if (node.kind !== 'town' || node.revenue.kind !== 'fixed') return []
        const ends = face.paths.filter((path) =>
            path.endpoints.some((end) => end.kind === 'node' && end.nodeId === node.id)
        )
        const edges = ends.flatMap((path) =>
            path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
        )
        if (ends.length !== 2 || edges.length !== 2) return []
        return [
            { edges: [edges[0], edges[1]] as [TileEdge, TileEdge], revenue: node.revenue.amount }
        ]
    })
}

/**
 * The stops a replacing tile carries from the tile it replaces, both turned as they lie on the
 * map: each town alone on a line moves to the same line of the new tile where that is plain
 * track there. Towns the new tile prints itself stay printed.
 */
export function carriedTrackStops(before: TileFace, after: TileFace): TrackStop[] {
    const lines = after.paths.flatMap((path) => {
        const line = plainLine(path)
        return line ? [line] : []
    })
    return townsOnLines(before).filter((stop) => lines.some((line) => sameLine(line, stop.edges)))
}

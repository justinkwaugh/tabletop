import type { TileEndpoint, TileFace, TileNode } from '../tiles/tile.js'
import { rotateTileFace, sameTileEndpoint } from '../tiles/topology.js'
import type { RailwayMapState } from '../map/mapState.js'
import type { RevenueCenter, RoutePath } from './route.js'
export type RouteVisit = RevenueCenter & { node: Exclude<TileNode, { kind: 'junction' }> }
export type RouteTrace = {
    visits: RouteVisit[]
    resources: string[]
    crossings: number
    end: { locationId: string; endpoint: TileEndpoint }
}
export type RouteTraceEvaluation =
    | { trace: RouteTrace; reason?: never }
    | { trace?: never; reason: string }
export class RouteNetwork {
    private readonly faces: Map<string, TileFace>
    constructor(readonly mapState: RailwayMapState) {
        this.faces = new Map(
            mapState.map.definition.locations.map(({ id }) => {
                const tile = mapState.tile(id)
                return [id, rotateTileFace(tile.face, tile.rotation)]
            })
        )
    }
    centers(): RevenueCenter[] {
        return [...this.faces].flatMap(([locationId, face]) =>
            face.nodes.flatMap((node) =>
                node.kind !== 'junction' &&
                face.paths.some((path) =>
                    path.endpoints.some((end) => end.kind === 'node' && end.nodeId === node.id)
                )
                    ? [{ locationId, nodeId: node.id }]
                    : []
            )
        )
    }
    trace(start: RevenueCenter, paths: readonly RoutePath[]): RouteTraceEvaluation {
        const node = this.faces
            .get(start.locationId)
            ?.nodes.find((node) => node.id === start.nodeId)
        if (!node || node.kind === 'junction') return { reason: 'Start at a revenue center.' }
        const trace: RouteTrace = {
            visits: [{ ...start, node }],
            resources: [],
            crossings: 0,
            end: { locationId: start.locationId, endpoint: { kind: 'node', nodeId: start.nodeId } }
        }
        const used = new Set<string>()
        for (const segment of paths) {
            let { locationId, endpoint } = trace.end
            if (endpoint.kind === 'edge') {
                const edge = endpoint.edge
                const connection = this.mapState
                    .connections(locationId)
                    .find((connection) => connection.edge === edge)
                if (!connection) return { reason: 'The route leaves connected track.' }
                locationId = connection.neighborLocationId
                endpoint = { kind: 'edge', edge: connection.neighborEdge }
                trace.crossings++
            }
            if (locationId !== segment.locationId) return { reason: 'The route is disconnected.' }
            const path = this.faces
                .get(locationId)
                ?.paths.find((path) => path.id === segment.pathId)
            if (!path || !path.endpoints.some((end) => sameTileEndpoint(end, endpoint)))
                return { reason: 'The route is disconnected.' }
            const resources = [
                JSON.stringify([locationId, 'path', path.id]),
                ...path.endpoints.flatMap((end) =>
                    end.kind === 'edge' ? [JSON.stringify([locationId, 'edge', end.edge])] : []
                )
            ]
            if (resources.some((key) => used.has(key)))
                return { reason: 'A route cannot reuse track or a hex border.' }
            for (const key of resources) {
                used.add(key)
                trace.resources.push(key)
            }
            const end = sameTileEndpoint(path.endpoints[0], endpoint)
                ? path.endpoints[1]
                : path.endpoints[0]
            trace.end = { locationId, endpoint: end }
            if (end.kind === 'node') {
                const node = this.faces
                    .get(locationId)!
                    .nodes.find((node) => node.id === end.nodeId)!
                if (node.kind !== 'junction')
                    trace.visits.push({ locationId, nodeId: node.id, node })
            }
        }
        return { trace }
    }
    extensions(start: RevenueCenter, paths: readonly RoutePath[]): RoutePath[] {
        const result = this.trace(start, paths)
        if (!result.trace) return []
        let { locationId, endpoint } = result.trace.end
        if (endpoint.kind === 'edge') {
            const edge = endpoint.edge
            const connection = this.mapState
                .connections(locationId)
                .find((connection) => connection.edge === edge)
            if (!connection) return []
            locationId = connection.neighborLocationId
            endpoint = { kind: 'edge', edge: connection.neighborEdge }
        }
        const current = endpoint
        return this.faces
            .get(locationId)!
            .paths.filter((path) => path.endpoints.some((end) => sameTileEndpoint(end, current)))
            .map((path) => ({ locationId, pathId: path.id }))
            .filter((path) => this.trace(start, [...paths, path]).trace)
    }
}

import { assertExists } from '@tabletop/common'
import { routePathResources } from './routeResources.js'
import type { TileEndpoint, TileFace, TileNode, TilePath } from '../tiles/tile.js'
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
    { trace: RouteTrace; reason?: never } | { trace?: never; reason: string }
/** A walk along track from a stop, as a route's trace would follow it, while it is being walked. */
export type RouteWalk = {
    readonly start: RevenueCenter
    readonly paths: readonly RoutePath[]
    readonly visits: readonly RouteVisit[]
    readonly crossings: number
}
export type RouteWalkOptions = {
    /** Track and hex sides the walk may not use, as another part of the same route uses them. */
    used?: ReadonlySet<string>
    /** Which paths the walk may leave its start by. */
    first?(path: RoutePath): boolean
}
type TrackEnd = RouteTrace['end']
export class RouteNetwork {
    private readonly faces: Map<string, TileFace>
    private readonly crossings = new Map<string, TrackEnd | undefined>()
    constructor(readonly mapState: RailwayMapState) {
        this.faces = new Map(
            mapState.map.definition.locations.map(({ id }) => {
                const tile = mapState.tile(id)
                return [id, rotateTileFace(tile.face, tile.rotation)]
            })
        )
    }
    face(locationId: string): TileFace {
        const face = this.faces.get(locationId)
        assertExists(face, 'Unknown route location')
        return face
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
        const junctions = new Set<string>()
        for (const segment of paths) {
            const arrival = this.arrive(trace.end)
            if (!arrival) return { reason: 'The route leaves connected track.' }
            const { locationId, endpoint } = arrival
            trace.crossings += arrival.crossed
            if (locationId !== segment.locationId) return { reason: 'The route is disconnected.' }
            const path = this.faces
                .get(locationId)
                ?.paths.find((path) => path.id === segment.pathId)
            if (!path || !path.endpoints.some((end) => sameTileEndpoint(end, endpoint)))
                return { reason: 'The route is disconnected.' }
            const resources = routePathResources(locationId, path)
            if (resources.some((key) => used.has(key)))
                return { reason: 'A route cannot reuse track or a hex border.' }
            for (const key of resources) {
                used.add(key)
                trace.resources.push(key)
            }
            const end = this.farEnd(path, endpoint)
            trace.end = { locationId, endpoint: end }
            const reached = this.reached(locationId, end)
            if (reached?.kind === 'junction') {
                const key = JSON.stringify([locationId, reached.id])
                if (junctions.has(key))
                    return { reason: 'A route cannot revisit a junction between two stops.' }
                junctions.add(key)
            } else if (reached) {
                trace.visits.push({ locationId, nodeId: reached.id, node: reached })
                junctions.clear()
            }
        }
        return { trace }
    }
    /**
     * Walks every way along track from a stop, path by path, as `trace` would follow a route: never
     * reusing track or a hex side, nor a junction between two stops. `step` sees each walk as it
     * reaches a path's far end, and whether that end is a stop; the walk goes on only when it
     * returns true. The walk is reused as it changes, so copy what should be kept.
     */
    walk(
        start: RevenueCenter,
        options: RouteWalkOptions,
        step: (walk: RouteWalk, atStop: boolean) => boolean
    ): void {
        const node = this.reached(start.locationId, { kind: 'node', nodeId: start.nodeId })
        assertExists(node, 'A walk starts at a node')
        if (node.kind === 'junction') return
        const paths: RoutePath[] = []
        const visits: RouteVisit[] = [{ ...start, node }]
        const used = new Set(options.used)
        let junctions = new Set<string>()
        const walk = {
            start,
            paths,
            visits,
            crossings: 0
        }
        const extend = (end: TrackEnd) => {
            const arrival = this.arrive(end)
            if (!arrival) return
            const { locationId, endpoint } = arrival
            for (const path of this.face(locationId).paths) {
                if (!path.endpoints.some((other) => sameTileEndpoint(other, endpoint))) continue
                const routePath = { locationId, pathId: path.id }
                if (!paths.length && options.first && !options.first(routePath)) continue
                const resources = routePathResources(locationId, path)
                if (resources.some((key) => used.has(key))) continue
                const far = this.farEnd(path, endpoint)
                const reached = this.reached(locationId, far)
                const junction =
                    reached?.kind === 'junction' ? JSON.stringify([locationId, reached.id]) : ''
                if (junction && junctions.has(junction)) continue
                const stop = reached && reached.kind !== 'junction' ? reached : undefined
                const outer = junctions
                if (junction) junctions.add(junction)
                if (stop) {
                    visits.push({ locationId, nodeId: stop.id, node: stop })
                    junctions = new Set()
                }
                for (const key of resources) used.add(key)
                paths.push(routePath)
                walk.crossings += arrival.crossed
                if (step(walk, !!stop)) extend({ locationId, endpoint: far })
                walk.crossings -= arrival.crossed
                paths.pop()
                for (const key of resources) used.delete(key)
                junctions = outer
                if (junction) junctions.delete(junction)
                if (stop) visits.pop()
            }
        }
        extend({ locationId: start.locationId, endpoint: { kind: 'node', nodeId: start.nodeId } })
    }
    extensions(start: RevenueCenter, paths: readonly RoutePath[]): RoutePath[] {
        const result = this.trace(start, paths)
        if (!result.trace) return []
        const arrival = this.arrive(result.trace.end)
        if (!arrival) return []
        const { locationId, endpoint } = arrival
        return this.face(locationId)
            .paths.filter((path) => path.endpoints.some((end) => sameTileEndpoint(end, endpoint)))
            .map((path) => ({ locationId, pathId: path.id }))
            .filter((path) => this.trace(start, [...paths, path]).trace)
    }
    /** Where track continues from an end: across the hex side it reaches, if track meets it there. */
    private arrive(end: TrackEnd): (TrackEnd & { crossed: 0 | 1 }) | undefined {
        if (end.endpoint.kind !== 'edge') return { ...end, crossed: 0 }
        const key = `${end.locationId} ${end.endpoint.edge}`
        if (!this.crossings.has(key)) {
            const edge = end.endpoint.edge
            const connection = this.mapState
                .connections(end.locationId)
                .find((connection) => connection.edge === edge)
            this.crossings.set(
                key,
                connection && {
                    locationId: connection.neighborLocationId,
                    endpoint: { kind: 'edge', edge: connection.neighborEdge }
                }
            )
        }
        const across = this.crossings.get(key)
        return across && { ...across, crossed: 1 }
    }
    private farEnd(path: TilePath, from: TileEndpoint): TileEndpoint {
        return sameTileEndpoint(path.endpoints[0], from) ? path.endpoints[1] : path.endpoints[0]
    }
    private reached(locationId: string, endpoint: TileEndpoint): TileNode | undefined {
        if (endpoint.kind !== 'node') return undefined
        return this.faces.get(locationId)?.nodes.find((node) => node.id === endpoint.nodeId)
    }
}

import type { BusNodeId } from '@tabletop/bus'
import type { Point } from '@tabletop/common'
import { BUS_BOARD_NODE_POINTS } from './busBoardGraph.js'

export const ROUTE_STROKE_WIDTH = 12
export const ROUTE_OUTLINE_WIDTH = 3

const SHARED_EDGE_LANE_GAP = ROUTE_STROKE_WIDTH + ROUTE_OUTLINE_WIDTH
const NODE_JOIN_RADIUS = 18
const TERMINAL_JOIN_RADIUS = 24
const TERMINAL_ARROW_INSET = 2
const TERMINAL_ARROW_HEAD_LENGTH = 6
const TERMINAL_ARROW_HEAD_HALF_WIDTH = 3
const TERMINAL_ARROW_NECK_HALF_WIDTH = 1.25
const TERMINAL_ARROW_NECK_SETBACK = 1.8
const TERMINAL_ARROW_TAIL_LENGTH = 6
const TERMINAL_ARROW_TAIL_HALF_WIDTH = 0.9

export type BusRouteDefinition = {
    id: string
    color: string
    nodeIds: readonly BusNodeId[]
}

export type RenderSegment = {
    key: string
    x1: number
    y1: number
    x2: number
    y2: number
}

export type RenderConnector = {
    key: string
    d: string
}

export type RenderArrow = {
    key: string
    d: string
}

export type RouteRenderLayer = {
    id: string
    color: string
    segments: RenderSegment[]
    connectors: RenderConnector[]
    terminalArrows: RenderArrow[]
}

type Vector = Point

type SegmentBase = {
    routeId: string
    from: BusNodeId
    to: BusNodeId
    edge: string
    routeOrder: number
}

type ContinuityConstraint = {
    edgeA: string
    edgeB: string
    normalA: Vector
    normalB: Vector
    offsetA: number
    offsetB: number
}

function edgeKey(from: BusNodeId, to: BusNodeId): string {
    return from < to ? `${from}:${to}` : `${to}:${from}`
}

function laneOffset(index: number, laneCount: number): number {
    return (index - (laneCount - 1) / 2) * SHARED_EDGE_LANE_GAP
}

function add(left: Vector, right: Vector): Vector {
    return { x: left.x + right.x, y: left.y + right.y }
}

function subtract(left: Vector, right: Vector): Vector {
    return { x: left.x - right.x, y: left.y - right.y }
}

function scale(vector: Vector, factor: number): Vector {
    return { x: vector.x * factor, y: vector.y * factor }
}

function length(vector: Vector): number {
    return Math.hypot(vector.x, vector.y)
}

function normalize(vector: Vector): Vector {
    const value = length(vector)
    if (value === 0) {
        return { x: 0, y: 0 }
    }

    return { x: vector.x / value, y: vector.y / value }
}

function perpendicular(vector: Vector): Vector {
    return { x: -vector.y, y: vector.x }
}

function pointOf(nodeId: BusNodeId): Vector {
    const point = BUS_BOARD_NODE_POINTS[nodeId]
    return { x: point.x, y: point.y }
}

function edgeEndpoints(edge: string): [BusNodeId, BusNodeId] {
    return edge.split(':') as [BusNodeId, BusNodeId]
}

function edgeBaseNormal(edge: string): Vector {
    const [fromId, toId] = edgeEndpoints(edge)
    return perpendicular(normalize(subtract(pointOf(toId), pointOf(fromId))))
}

function cubicPath(from: Vector, controlA: Vector, controlB: Vector, to: Vector): string {
    return `M ${from.x} ${from.y} C ${controlA.x} ${controlA.y} ${controlB.x} ${controlB.y} ${to.x} ${to.y}`
}

export function computeBusRouteRenderLayers(
    routeDefinitions: readonly BusRouteDefinition[]
): RouteRenderLayer[] {
    if (routeDefinitions.length === 0) {
        return []
    }

    const routeOrderById = new Map(routeDefinitions.map((route, index) => [route.id, index]))
    const edgeSegments = new Map<string, SegmentBase[]>()

    for (const route of routeDefinitions) {
        for (let index = 0; index < route.nodeIds.length - 1; index += 1) {
            const from = route.nodeIds[index]
            const to = route.nodeIds[index + 1]
            if (!from || !to) {
                continue
            }
            const edge = edgeKey(from, to)
            const segment: SegmentBase = {
                routeId: route.id,
                from,
                to,
                edge,
                routeOrder: routeOrderById.get(route.id) ?? 0
            }

            const existing = edgeSegments.get(edge)
            if (existing) {
                existing.push(segment)
            } else {
                edgeSegments.set(edge, [segment])
            }
        }
    }

    const edgeLaneOffsets = new Map<string, Map<string, number>>()
    const edgeBaseNormals = new Map<string, Vector>()

    for (const [edge, group] of edgeSegments) {
        group.sort((left, right) => left.routeOrder - right.routeOrder)
        edgeBaseNormals.set(edge, edgeBaseNormal(edge))

        const offsets = new Map<string, number>()
        for (let laneIndex = 0; laneIndex < group.length; laneIndex += 1) {
            const segment = group[laneIndex]
            if (!segment) {
                continue
            }
            offsets.set(segment.routeId, laneOffset(laneIndex, group.length))
        }

        edgeLaneOffsets.set(edge, offsets)
    }

    function laneOffsetFor(edge: string, routeId: string): number {
        return edgeLaneOffsets.get(edge)?.get(routeId) ?? 0
    }

    const continuityConstraints: ContinuityConstraint[] = []
    for (const route of routeDefinitions) {
        for (let index = 1; index < route.nodeIds.length - 1; index += 1) {
            const previousNodeId = route.nodeIds[index - 1]
            const nodeId = route.nodeIds[index]
            const nextNodeId = route.nodeIds[index + 1]
            if (!previousNodeId || !nodeId || !nextNodeId) {
                continue
            }

            const inEdge = edgeKey(previousNodeId, nodeId)
            const outEdge = edgeKey(nodeId, nextNodeId)

            const inNormal = edgeBaseNormals.get(inEdge)
            const outNormal = edgeBaseNormals.get(outEdge)
            if (!inNormal || !outNormal) {
                continue
            }

            continuityConstraints.push({
                edgeA: inEdge,
                edgeB: outEdge,
                normalA: inNormal,
                normalB: outNormal,
                offsetA: laneOffsetFor(inEdge, route.id),
                offsetB: laneOffsetFor(outEdge, route.id)
            })
        }
    }

    const edgeSigns = new Map<string, number>()
    for (const edge of edgeSegments.keys()) {
        edgeSigns.set(edge, 1)
    }

    function signFor(edge: string, overrideEdge?: string, overrideSign?: number): number {
        if (edge === overrideEdge && overrideSign !== undefined) {
            return overrideSign
        }

        return edgeSigns.get(edge) ?? 1
    }

    function continuityCost(overrideEdge?: string, overrideSign?: number): number {
        let cost = 0

        for (const constraint of continuityConstraints) {
            const signA = signFor(constraint.edgeA, overrideEdge, overrideSign)
            const signB = signFor(constraint.edgeB, overrideEdge, overrideSign)

            const vectorA = scale(constraint.normalA, constraint.offsetA * signA)
            const vectorB = scale(constraint.normalB, constraint.offsetB * signB)
            const delta = subtract(vectorA, vectorB)
            cost += delta.x * delta.x + delta.y * delta.y
        }

        return cost
    }

    for (let iteration = 0; iteration < 12; iteration += 1) {
        let changed = false

        for (const edge of edgeSigns.keys()) {
            const positiveCost = continuityCost(edge, 1)
            const negativeCost = continuityCost(edge, -1)
            const nextSign = negativeCost < positiveCost ? -1 : 1

            if ((edgeSigns.get(edge) ?? 1) !== nextSign) {
                edgeSigns.set(edge, nextSign)
                changed = true
            }
        }

        if (!changed) {
            break
        }
    }

    const edgeNormals = new Map<string, Vector>()
    for (const [edge, baseNormal] of edgeBaseNormals) {
        edgeNormals.set(edge, scale(baseNormal, edgeSigns.get(edge) ?? 1))
    }

    function normalFor(edge: string): Vector {
        return edgeNormals.get(edge) ?? { x: 0, y: 0 }
    }

    function anchorAtNode(nodeId: BusNodeId, otherId: BusNodeId, routeId: string): Vector {
        const edge = edgeKey(nodeId, otherId)
        return anchorAtNodeWithOffsetAndRadius(nodeId, otherId, laneOffsetFor(edge, routeId), NODE_JOIN_RADIUS)
    }

    function anchorAtNodeWithOffsetAndRadius(
        nodeId: BusNodeId,
        otherId: BusNodeId,
        offset: number,
        joinRadius: number
    ): Vector {
        const edge = edgeKey(nodeId, otherId)
        const nodePoint = pointOf(nodeId)
        const otherPoint = pointOf(otherId)
        const outwardDirection = normalize(subtract(otherPoint, nodePoint))
        const normal = normalFor(edge)

        return add(add(nodePoint, scale(normal, offset)), scale(outwardDirection, joinRadius))
    }

    function terminalAnchorAtNode(nodeId: BusNodeId, otherId: BusNodeId, routeId: string): Vector {
        const edge = edgeKey(nodeId, otherId)
        return anchorAtNodeWithOffsetAndRadius(
            nodeId,
            otherId,
            laneOffsetFor(edge, routeId),
            TERMINAL_JOIN_RADIUS
        )
    }

    function junctionCurvePath(
        nodeId: BusNodeId,
        previousNodeId: BusNodeId,
        nextNodeId: BusNodeId,
        routeId: string
    ): string {
        const startAnchor = anchorAtNode(nodeId, previousNodeId, routeId)
        const endAnchor = anchorAtNode(nodeId, nextNodeId, routeId)
        const segmentDistance = length(subtract(endAnchor, startAnchor))
        const controlDistance = Math.max(
            NODE_JOIN_RADIUS * 0.55,
            Math.min(segmentDistance * 0.45, NODE_JOIN_RADIUS * 1.45)
        )

        const startTangent = normalize(subtract(pointOf(nodeId), pointOf(previousNodeId)))
        const endTangent = normalize(subtract(pointOf(nextNodeId), pointOf(nodeId)))
        const controlA = add(startAnchor, scale(startTangent, controlDistance))
        const controlB = subtract(endAnchor, scale(endTangent, controlDistance))

        return cubicPath(startAnchor, controlA, controlB, endAnchor)
    }

    function terminalArrowPath(terminal: Vector, towardInterior: Vector): string {
        const outward = normalize(subtract(terminal, towardInterior))
        const perpendicularOutward = perpendicular(outward)
        const tip = subtract(terminal, scale(outward, TERMINAL_ARROW_INSET))
        const headBaseCenter = subtract(tip, scale(outward, TERMINAL_ARROW_HEAD_LENGTH))
        const neckCenter = subtract(headBaseCenter, scale(outward, TERMINAL_ARROW_NECK_SETBACK))
        const tailCenter = subtract(neckCenter, scale(outward, TERMINAL_ARROW_TAIL_LENGTH))
        const headLeft = add(headBaseCenter, scale(perpendicularOutward, TERMINAL_ARROW_HEAD_HALF_WIDTH))
        const headRight = subtract(headBaseCenter, scale(perpendicularOutward, TERMINAL_ARROW_HEAD_HALF_WIDTH))
        const neckLeft = add(neckCenter, scale(perpendicularOutward, TERMINAL_ARROW_NECK_HALF_WIDTH))
        const neckRight = subtract(neckCenter, scale(perpendicularOutward, TERMINAL_ARROW_NECK_HALF_WIDTH))
        const tailLeft = add(tailCenter, scale(perpendicularOutward, TERMINAL_ARROW_TAIL_HALF_WIDTH))
        const tailRight = subtract(tailCenter, scale(perpendicularOutward, TERMINAL_ARROW_TAIL_HALF_WIDTH))

        return `M ${tip.x} ${tip.y} L ${headLeft.x} ${headLeft.y} L ${neckLeft.x} ${neckLeft.y} L ${tailLeft.x} ${tailLeft.y} L ${tailRight.x} ${tailRight.y} L ${neckRight.x} ${neckRight.y} L ${headRight.x} ${headRight.y} Z`
    }

    const routeRenderLayers: RouteRenderLayer[] = routeDefinitions.map((route) => ({
        id: route.id,
        color: route.color,
        segments: [],
        connectors: [],
        terminalArrows: []
    }))
    const layerById = new Map(routeRenderLayers.map((layer) => [layer.id, layer]))

    for (const route of routeDefinitions) {
        const layer = layerById.get(route.id)
        if (!layer) {
            continue
        }

        for (let index = 0; index < route.nodeIds.length - 1; index += 1) {
            const fromId = route.nodeIds[index]
            const toId = route.nodeIds[index + 1]
            if (!fromId || !toId) {
                continue
            }

            const isFirstSegment = index === 0
            const isLastSegment = index === route.nodeIds.length - 2
            const startAnchor = isFirstSegment
                ? terminalAnchorAtNode(fromId, toId, route.id)
                : anchorAtNode(fromId, toId, route.id)
            const endAnchor = isLastSegment
                ? terminalAnchorAtNode(toId, fromId, route.id)
                : anchorAtNode(toId, fromId, route.id)

            layer.segments.push({
                key: `${route.id}:segment:${fromId}-${toId}:${index}`,
                x1: startAnchor.x,
                y1: startAnchor.y,
                x2: endAnchor.x,
                y2: endAnchor.y
            })

            if (isFirstSegment) {
                layer.terminalArrows.push({
                    key: `${route.id}:arrow:start:${fromId}`,
                    d: terminalArrowPath(startAnchor, endAnchor)
                })
            }

            if (isLastSegment) {
                layer.terminalArrows.push({
                    key: `${route.id}:arrow:end:${toId}`,
                    d: terminalArrowPath(endAnchor, startAnchor)
                })
            }
        }

        for (let index = 1; index < route.nodeIds.length - 1; index += 1) {
            const previousNodeId = route.nodeIds[index - 1]
            const nodeId = route.nodeIds[index]
            const nextNodeId = route.nodeIds[index + 1]
            if (!previousNodeId || !nodeId || !nextNodeId) {
                continue
            }

            layer.connectors.push({
                key: `${route.id}:junction:${previousNodeId}-${nodeId}-${nextNodeId}:${index}`,
                d: junctionCurvePath(nodeId, previousNodeId, nextNodeId, route.id)
            })
        }
    }

    return routeRenderLayers
}


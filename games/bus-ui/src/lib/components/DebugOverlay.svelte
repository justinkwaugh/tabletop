<script lang="ts">
    import { busGraph, type BusNodeId } from '@tabletop/bus'
    import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'

    const BOARD_WIDTH = 1839
    const BOARD_HEIGHT = 1300

    const BLUE_LINE_COLOR = '#0c66b4'
    const YELLOW_LINE_COLOR = '#fba01c'
    const RED_LINE_COLOR = '#ef2519'
    const ROUTE_STROKE_WIDTH = 12
    const ROUTE_OUTLINE_WIDTH = 3
    const SHARED_EDGE_LANE_GAP = ROUTE_STROKE_WIDTH

    type RouteDefinition = {
        id: string
        color: string
        nodeIds: readonly BusNodeId[]
        waypointNodeIds: readonly BusNodeId[]
    }

    type RenderSegment = {
        key: string
        routeId: string
        routeOrder: number
        routeStep: number
        color: string
        x1: number
        y1: number
        x2: number
        y2: number
    }

    type OutlineSegment = {
        key: string
        x1: number
        y1: number
        x2: number
        y2: number
        strokeWidth: number
    }

    const routeDefinitions: readonly RouteDefinition[] = [
        {
            id: 'blue',
            color: BLUE_LINE_COLOR,
            // Route: 36 -> 28 -> 24 -> 17 -> 5 (with valid intermediate hops)
            nodeIds: ['N36', 'N28', 'N21', 'N22', 'N24', 'N17', 'N14', 'N09', 'N05'],
            waypointNodeIds: ['N36', 'N28', 'N24', 'N17', 'N05']
        },
        {
            id: 'yellow',
            color: YELLOW_LINE_COLOR,
            // Crosses blue line and shares the N22-N24 edge with blue.
            nodeIds: ['N02', 'N08', 'N10', 'N15', 'N23', 'N20', 'N24', 'N22', 'N30', 'N24', 'N31', 'N34'],
            waypointNodeIds: ['N02', 'N24', 'N34']
        },
        {
            id: 'red',
            color: RED_LINE_COLOR,
            // Shares the same N22-N24 edge as blue and yellow.
            nodeIds: ['N35', 'N22', 'N24', 'N17', 'N15', 'N23', 'N27'],
            waypointNodeIds: ['N35', 'N24', 'N27']
        }
    ] as const

    function edgeKey(from: BusNodeId, to: BusNodeId): string {
        return from < to ? `${from}:${to}` : `${to}:${from}`
    }

    function nodeNumber(id: BusNodeId): number {
        return Number(id.slice(1))
    }

    function hasGraphEdge(from: BusNodeId, to: BusNodeId): boolean {
        const fromNode = busGraph.nodeById(from)
        return fromNode?.neighbors.includes(to) ?? false
    }

    function validateRoute(route: RouteDefinition) {
        const usedEdgeKeys = new Set<string>()

        for (let index = 0; index < route.nodeIds.length - 1; index += 1) {
            const fromId = route.nodeIds[index]
            const toId = route.nodeIds[index + 1]

            if (!hasGraphEdge(fromId, toId)) {
                throw new Error(`Invalid ${route.id} route edge: ${fromId}-${toId}`)
            }

            const key = edgeKey(fromId, toId)
            if (usedEdgeKeys.has(key)) {
                throw new Error(`${route.id} route repeats edge: ${fromId}-${toId}`)
            }

            usedEdgeKeys.add(key)
        }
    }

    function routeEdgeKeys(nodeIds: readonly BusNodeId[]): Set<string> {
        const keys = new Set<string>()

        for (let index = 0; index < nodeIds.length - 1; index += 1) {
            keys.add(edgeKey(nodeIds[index], nodeIds[index + 1]))
        }

        return keys
    }

    function edgeAngleDegrees(from: BusNodeId, to: BusNodeId): number {
        const fromPoint = BUS_BOARD_NODE_POINTS[from]
        const toPoint = BUS_BOARD_NODE_POINTS[to]
        return (Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x) * 180) / Math.PI
    }

    function parallelAngleDifferenceDegrees(a: number, b: number): number {
        let diff = Math.abs(a - b) % 180
        if (diff > 90) {
            diff = 180 - diff
        }

        return diff
    }

    function laneOffset(index: number, laneCount: number): number {
        return (index - (laneCount - 1) / 2) * SHARED_EDGE_LANE_GAP
    }

    const BLUE_PARALLEL_EDGE = ['N14', 'N17'] as const satisfies readonly [BusNodeId, BusNodeId]
    const YELLOW_PARALLEL_EDGE = ['N10', 'N15'] as const satisfies readonly [BusNodeId, BusNodeId]

    const { outlineSegments, routeSegments }: {
        outlineSegments: OutlineSegment[]
        routeSegments: RenderSegment[]
    } = (() => {
        type SegmentBase = {
            routeId: string
            color: string
            from: BusNodeId
            to: BusNodeId
            edge: string
            routeOrder: number
            routeStep: number
        }

        const routeOrderById = new Map(routeDefinitions.map((route, index) => [route.id, index]))
        const edgeSegments = new Map<string, SegmentBase[]>()

        for (const route of routeDefinitions) {
            for (let index = 0; index < route.nodeIds.length - 1; index += 1) {
                const from = route.nodeIds[index]
                const to = route.nodeIds[index + 1]
                const edge = edgeKey(from, to)
                const segment: SegmentBase = {
                    routeId: route.id,
                    color: route.color,
                    from,
                    to,
                    edge,
                    routeOrder: routeOrderById.get(route.id) ?? 0,
                    routeStep: index
                }

                const existing = edgeSegments.get(edge)
                if (existing) {
                    existing.push(segment)
                } else {
                    edgeSegments.set(edge, [segment])
                }
            }
        }

        const outlineSegments: OutlineSegment[] = []
        const routeSegments: RenderSegment[] = []

        for (const [edge, group] of edgeSegments) {
            group.sort((a, b) => a.routeOrder - b.routeOrder)

            const [canonicalFrom, canonicalTo] = edge.split(':') as [BusNodeId, BusNodeId]
            const canonicalFromPoint = BUS_BOARD_NODE_POINTS[canonicalFrom]
            const canonicalToPoint = BUS_BOARD_NODE_POINTS[canonicalTo]

            const dx = canonicalToPoint.x - canonicalFromPoint.x
            const dy = canonicalToPoint.y - canonicalFromPoint.y
            const length = Math.hypot(dx, dy)
            const normalX = length === 0 ? 0 : -dy / length
            const normalY = length === 0 ? 0 : dx / length

            const laneCount = group.length
            const fillWidth = ROUTE_STROKE_WIDTH + (laneCount - 1) * SHARED_EDGE_LANE_GAP
            outlineSegments.push({
                key: `outline:${edge}`,
                x1: canonicalFromPoint.x,
                y1: canonicalFromPoint.y,
                x2: canonicalToPoint.x,
                y2: canonicalToPoint.y,
                strokeWidth: fillWidth + ROUTE_OUTLINE_WIDTH * 2
            })

            for (let laneIndex = 0; laneIndex < group.length; laneIndex += 1) {
                const segment = group[laneIndex]
                const offset = laneOffset(laneIndex, group.length)

                const fromPoint = BUS_BOARD_NODE_POINTS[segment.from]
                const toPoint = BUS_BOARD_NODE_POINTS[segment.to]

                routeSegments.push({
                    key: `${segment.routeId}:${segment.from}-${segment.to}:${segment.edge}`,
                    routeId: segment.routeId,
                    routeOrder: segment.routeOrder,
                    routeStep: segment.routeStep,
                    color: segment.color,
                    x1: fromPoint.x + normalX * offset,
                    y1: fromPoint.y + normalY * offset,
                    x2: toPoint.x + normalX * offset,
                    y2: toPoint.y + normalY * offset
                })
            }
        }

        routeSegments.sort((left, right) => {
            const orderDiff = left.routeOrder - right.routeOrder
            if (orderDiff !== 0) {
                return orderDiff
            }

            return left.routeStep - right.routeStep
        })

        return { outlineSegments, routeSegments }
    })()

    ;(() => {
        for (const route of routeDefinitions) {
            validateRoute(route)
        }

        const blueNodes = new Set(routeDefinitions[0].nodeIds)
        const yellowNodes = routeDefinitions[1].nodeIds
        const sharedNodes = yellowNodes.filter((nodeId) => blueNodes.has(nodeId))
        if (sharedNodes.length === 0) {
            throw new Error('Yellow route must cross the blue route at least once')
        }

        const blueEdgeKeys = routeEdgeKeys(routeDefinitions[0].nodeIds)
        const yellowEdgeKeys = routeEdgeKeys(routeDefinitions[1].nodeIds)
        const sharedEdgeCount = [...yellowEdgeKeys].filter((key) => blueEdgeKeys.has(key)).length
        if (sharedEdgeCount === 0) {
            throw new Error('Yellow route must share at least one edge with the blue route')
        }

        const blueAngle = edgeAngleDegrees(BLUE_PARALLEL_EDGE[0], BLUE_PARALLEL_EDGE[1])
        const yellowAngle = edgeAngleDegrees(YELLOW_PARALLEL_EDGE[0], YELLOW_PARALLEL_EDGE[1])
        const angleDiff = parallelAngleDifferenceDegrees(blueAngle, yellowAngle)
        if (angleDiff > 15) {
            throw new Error('Yellow route must include an edge parallel to the blue route')
        }
    })()
</script>

<svg
    class="pointer-events-none absolute inset-0 h-full w-full"
    viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
    aria-label="Bus preview line overlay"
>
    {#each outlineSegments as segment (segment.key)}
        <line
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke="#020617"
            stroke-width={segment.strokeWidth}
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    {/each}

    {#each routeSegments as segment (segment.key)}
        <line
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={segment.color}
            stroke-width={ROUTE_STROKE_WIDTH}
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    {/each}

    {#each routeDefinitions as route (route.id)}
        {#each route.waypointNodeIds as nodeId (`${route.id}:${nodeId}`)}
            {@const point = BUS_BOARD_NODE_POINTS[nodeId]}
            <g>
                <circle cx={point.x} cy={point.y} r="14" fill="#0f172a" fill-opacity="0.75" />
                <circle cx={point.x} cy={point.y} r="10" fill="#f8fafc" fill-opacity="0.92" />
                <text
                    x={point.x}
                    y={point.y + 4}
                    text-anchor="middle"
                    font-size="10"
                    font-weight="800"
                    fill="#0f172a"
                >
                    {nodeNumber(nodeId)}
                </text>
            </g>
        {/each}
    {/each}
</svg>

<script lang="ts">
    import { BUS_NODE_IDS, BUS_STATION_IDS, busGraph, type BusNodeId } from '@tabletop/bus'
    import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'

    const BOARD_WIDTH = 1839
    const BOARD_HEIGHT = 1300
    const EDGE_STROKE_WIDTH = 12
    const NODE_MARKER_RADIUS = 11
    const SHOW_EDGE_IDS = true

    type RenderEdge = {
        key: string
        from: BusNodeId
        to: BusNodeId
        fromNumber: number
        toNumber: number
    }

    type RenderNode = {
        id: BusNodeId
        number: number
        x: number
        y: number
        isStation: boolean
    }

    function createEdgeKey(from: BusNodeId, to: BusNodeId): string {
        return from < to ? `${from}:${to}` : `${to}:${from}`
    }

    function nodeNumber(id: BusNodeId): number {
        return Number(id.slice(1))
    }

    const stationNodeIds = new Set<BusNodeId>(BUS_STATION_IDS)

    const boardEdges: RenderEdge[] = (() => {
        const seenEdgeKeys = new Set<string>()
        const edges: RenderEdge[] = []

        for (const node of busGraph) {
            for (const neighbor of busGraph.neighborsOf(node)) {
                const edgeKey = createEdgeKey(node.id, neighbor.id)
                if (seenEdgeKeys.has(edgeKey)) {
                    continue
                }

                seenEdgeKeys.add(edgeKey)
                edges.push({
                    key: edgeKey,
                    from: node.id,
                    to: neighbor.id,
                    fromNumber: nodeNumber(node.id),
                    toNumber: nodeNumber(neighbor.id)
                })
            }
        }

        return edges
    })()

    const boardNodes: RenderNode[] = BUS_NODE_IDS.map((id) => {
        const point = BUS_BOARD_NODE_POINTS[id]
        return {
            id,
            number: nodeNumber(id),
            x: point.x,
            y: point.y,
            isStation: stationNodeIds.has(id)
        }
    })
</script>

<svg
    class="pointer-events-none absolute inset-0 h-full w-full"
    viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
    aria-label="Bus graph edge overlay"
>
    {#each boardEdges as edge (edge.key)}
        {@const startPoint = BUS_BOARD_NODE_POINTS[edge.from]}
        {@const endPoint = BUS_BOARD_NODE_POINTS[edge.to]}
        <line
            x1={startPoint.x}
            y1={startPoint.y}
            x2={endPoint.x}
            y2={endPoint.y}
            stroke="#ff2d95"
            stroke-opacity="0.85"
            stroke-width={EDGE_STROKE_WIDTH}
            stroke-linecap="round"
        />
        {#if SHOW_EDGE_IDS}
            <text
                x={(startPoint.x + endPoint.x) / 2}
                y={(startPoint.y + endPoint.y) / 2 - 4}
                text-anchor="middle"
                font-size="9"
                font-weight="700"
                fill="#fef3c7"
                stroke="#111827"
                stroke-width="2"
                paint-order="stroke"
            >
                {edge.fromNumber}-{edge.toNumber}
            </text>
        {/if}
    {/each}

    {#each boardNodes as node (node.id)}
        <g>
            <title>{node.id}</title>
            <circle
                cx={node.x}
                cy={node.y}
                r={NODE_MARKER_RADIUS}
                fill={node.isStation ? '#0ea5e9' : '#0f172a'}
                stroke="#ffffff"
                stroke-width="2"
            />
            <text
                x={node.x}
                y={node.y + 4}
                text-anchor="middle"
                font-size="10"
                font-weight="700"
                fill="#f8fafc"
            >
                {node.number}
            </text>
        </g>
    {/each}
</svg>

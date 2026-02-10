<script lang="ts">
    import { isBusNodeId, type BusLineSegment, type BusNodeId } from '@tabletop/bus'
    import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'
    import {
        ROUTE_OUTLINE_WIDTH,
        ROUTE_STROKE_WIDTH,
        computeBusRouteRenderLayers,
        type BusRouteDefinition
    } from '$lib/definitions/busLineRender.js'
    import type { BusGameSession } from '$lib/model/session.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession() as BusGameSession

    const PREVIEW_STROKE_WIDTH = ROUTE_STROKE_WIDTH
    const PREVIEW_OUTLINE_WIDTH = ROUTE_OUTLINE_WIDTH
    const START_HIT_STROKE_WIDTH = 34
    const TARGET_HIT_RADIUS = 28
    const TARGET_VISIBLE_RADIUS = 15
    const SOURCE_VISIBLE_RADIUS = 16

    let hoveredStartingSegmentKey = $state<string | undefined>()
    let hoveredTargetNodeId = $state<BusNodeId | undefined>()
    let hoveredSourceNodeId = $state<BusNodeId | undefined>()

    const myLineColor = $derived.by(() => {
        return gameSession.myPlayer
            ? gameSession.colors.getPlayerUiColor(gameSession.myPlayer.id)
            : '#0c66b4'
    })

    const routeDefinitions: BusRouteDefinition[] = $derived.by(() => {
        const routes: BusRouteDefinition[] = []
        for (const playerState of gameSession.gameState.players) {
            const nodeIds = playerState.busLine
            if (nodeIds.length < 2 || !nodeIds.every(isBusNodeId)) {
                continue
            }

            routes.push({
                id: playerState.playerId,
                color: gameSession.colors.getPlayerUiColor(playerState.playerId),
                nodeIds: [...nodeIds]
            })
        }

        return routes
    })

    const routeRenderLayers = $derived.by(() => {
        return computeBusRouteRenderLayers(routeDefinitions)
    })

    const previewSegment: BusLineSegment | undefined = $derived.by(() => {
        if (!gameSession.canPlaceBusLine) {
            return undefined
        }

        const lineNodeIds = gameSession.myBusLineNodeIds
        if (lineNodeIds.length === 0) {
            if (!hoveredStartingSegmentKey) {
                return undefined
            }

            return gameSession.startingBusLineSegments.find(
                (segment) => startSegmentKey(segment) === hoveredStartingSegmentKey
            )
        }

        const pendingTargetNodeId = gameSession.pendingBusLineTargetNodeId
        if (pendingTargetNodeId) {
            if (!hoveredSourceNodeId) {
                return undefined
            }

            return gameSession.segmentForSourceAndTargetNode(hoveredSourceNodeId, pendingTargetNodeId)
        }

        if (!hoveredTargetNodeId) {
            return undefined
        }

        return gameSession.unambiguousSegmentForTargetNode(hoveredTargetNodeId)
    })

    const previewPoints = $derived.by(() => {
        if (!previewSegment) {
            return undefined
        }

        const [fromNodeId, toNodeId] = previewSegment
        return {
            from: BUS_BOARD_NODE_POINTS[fromNodeId],
            to: BUS_BOARD_NODE_POINTS[toNodeId]
        }
    })

    const canInteract = $derived.by(() => gameSession.canPlaceBusLine)
    const isStartingPlacement = $derived.by(
        () => canInteract && gameSession.myBusLineNodeIds.length === 0
    )
    const pendingTargetNodeId = $derived.by(() => gameSession.pendingBusLineTargetNodeId)

    function startSegmentKey(segment: BusLineSegment): string {
        return `${segment[0]}:${segment[1]}`
    }

    function clearHoverState() {
        hoveredStartingSegmentKey = undefined
        hoveredTargetNodeId = undefined
        hoveredSourceNodeId = undefined
    }

    function onKeyboardActivate(event: KeyboardEvent, callback: () => void | Promise<void>) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }

        event.preventDefault()
        callback()
    }

    async function chooseStartingSegment(segment: BusLineSegment) {
        await gameSession.placeBusLineSegment(segment)
        clearHoverState()
    }

    async function chooseTargetNode(targetNodeId: BusNodeId) {
        await gameSession.chooseBusLineTargetNode(targetNodeId)
        hoveredTargetNodeId = undefined
        hoveredSourceNodeId = undefined
    }

    async function chooseSourceNode(sourceNodeId: BusNodeId) {
        await gameSession.confirmBusLineSourceNode(sourceNodeId)
        hoveredSourceNodeId = undefined
    }

    $effect(() => {
        if (!canInteract) {
            clearHoverState()
        }
    })

    $effect(() => {
        if (!pendingTargetNodeId) {
            hoveredSourceNodeId = undefined
        }
    })
</script>

<g class="pointer-events-none" aria-hidden="true">
    {#each routeRenderLayers as layer (layer.id)}
        {#each layer.segments as segment (`${segment.key}:outline`)}
            <line
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke="#020617"
                stroke-width={ROUTE_STROKE_WIDTH + ROUTE_OUTLINE_WIDTH * 2}
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        {/each}

        {#each layer.connectors as connector (`${connector.key}:outline`)}
            <path
                d={connector.d}
                stroke="#020617"
                stroke-width={ROUTE_STROKE_WIDTH + ROUTE_OUTLINE_WIDTH * 2}
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
            />
        {/each}

        {#each layer.segments as segment (`${segment.key}:fill`)}
            <line
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke={layer.color}
                stroke-width={ROUTE_STROKE_WIDTH}
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        {/each}

        {#each layer.connectors as connector (`${connector.key}:fill`)}
            <path
                d={connector.d}
                stroke={layer.color}
                stroke-width={ROUTE_STROKE_WIDTH}
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
            />
        {/each}

        {#each layer.terminalArrows as arrow (arrow.key)}
            <path d={arrow.d} fill="#ffffff" />
        {/each}
    {/each}

    {#if previewPoints}
        <line
            x1={previewPoints.from.x}
            y1={previewPoints.from.y}
            x2={previewPoints.to.x}
            y2={previewPoints.to.y}
            stroke="#020617"
            stroke-width={PREVIEW_STROKE_WIDTH + PREVIEW_OUTLINE_WIDTH * 2}
            stroke-linecap="round"
            opacity="0.95"
        />
        <line
            x1={previewPoints.from.x}
            y1={previewPoints.from.y}
            x2={previewPoints.to.x}
            y2={previewPoints.to.y}
            stroke={myLineColor}
            stroke-width={PREVIEW_STROKE_WIDTH}
            stroke-linecap="round"
            opacity="0.95"
        />
    {/if}
</g>

{#if canInteract}
    {#if isStartingPlacement}
        <g class="pointer-events-auto">
            {#each gameSession.startingBusLineSegments as segment (startSegmentKey(segment))}
                {@const fromPoint = BUS_BOARD_NODE_POINTS[segment[0]]}
                {@const toPoint = BUS_BOARD_NODE_POINTS[segment[1]]}
                <line
                    x1={fromPoint.x}
                    y1={fromPoint.y}
                    x2={toPoint.x}
                    y2={toPoint.y}
                    stroke="transparent"
                    stroke-width={START_HIT_STROKE_WIDTH}
                    stroke-linecap="round"
                    class="cursor-pointer"
                    role="button"
                    tabindex="0"
                    aria-label={`Place segment ${segment[0]} to ${segment[1]}`}
                    onmouseenter={() => (hoveredStartingSegmentKey = startSegmentKey(segment))}
                    onmouseleave={() => (hoveredStartingSegmentKey = undefined)}
                    onclick={() => chooseStartingSegment(segment)}
                    onkeydown={(event) => onKeyboardActivate(event, () => chooseStartingSegment(segment))}
                />
            {/each}
        </g>
    {:else}
        <g class="pointer-events-auto">
            {#if pendingTargetNodeId}
                {@const pendingPoint = BUS_BOARD_NODE_POINTS[pendingTargetNodeId]}
                <circle
                    cx={pendingPoint.x}
                    cy={pendingPoint.y}
                    r={TARGET_VISIBLE_RADIUS + 6}
                    fill="none"
                    stroke="#fff27a"
                    stroke-width="4"
                    opacity="0.95"
                    pointer-events="none"
                />
                <circle
                    cx={pendingPoint.x}
                    cy={pendingPoint.y}
                    r={TARGET_VISIBLE_RADIUS}
                    fill="rgba(251, 160, 28, 0.4)"
                    stroke="#facc15"
                    stroke-width="3"
                    pointer-events="none"
                />

                {#each gameSession.pendingBusLineSourceNodeIds as sourceNodeId (sourceNodeId)}
                    {@const sourcePoint = BUS_BOARD_NODE_POINTS[sourceNodeId]}
                    <circle
                        cx={sourcePoint.x}
                        cy={sourcePoint.y}
                        r={SOURCE_VISIBLE_RADIUS}
                        fill={hoveredSourceNodeId === sourceNodeId ? 'rgba(12, 102, 180, 0.45)' : 'rgba(12, 102, 180, 0.28)'}
                        stroke="#0c66b4"
                        stroke-width={hoveredSourceNodeId === sourceNodeId ? 4 : 3}
                        pointer-events="none"
                    />
                    <circle
                        cx={sourcePoint.x}
                        cy={sourcePoint.y}
                        r={TARGET_HIT_RADIUS}
                        fill="transparent"
                        class="cursor-pointer"
                        role="button"
                        tabindex="0"
                        aria-label={`Confirm source node ${sourceNodeId}`}
                        onmouseenter={() => (hoveredSourceNodeId = sourceNodeId)}
                        onmouseleave={() => (hoveredSourceNodeId = undefined)}
                        onclick={() => chooseSourceNode(sourceNodeId)}
                        onkeydown={(event) => onKeyboardActivate(event, () => chooseSourceNode(sourceNodeId))}
                    />
                {/each}
            {:else}
                {#each gameSession.selectableBusLineTargetNodeIds as targetNodeId (targetNodeId)}
                    {@const point = BUS_BOARD_NODE_POINTS[targetNodeId]}
                    {@const isAmbiguous = gameSession.isAmbiguousBusLineTargetNode(targetNodeId)}
                    {@const isHovered = hoveredTargetNodeId === targetNodeId}
                    <circle
                        cx={point.x}
                        cy={point.y}
                        r={TARGET_VISIBLE_RADIUS}
                        fill={isHovered ? 'rgba(255, 242, 122, 0.45)' : isAmbiguous ? 'rgba(251, 160, 28, 0.32)' : 'rgba(250, 204, 21, 0.24)'}
                        stroke={isHovered ? '#fff27a' : isAmbiguous ? '#fba01c' : '#facc15'}
                        stroke-width={isHovered ? 4 : 3}
                        pointer-events="none"
                    />
                    <circle
                        cx={point.x}
                        cy={point.y}
                        r={TARGET_HIT_RADIUS}
                        fill="transparent"
                        class="cursor-pointer"
                        role="button"
                        tabindex="0"
                        aria-label={`Choose target node ${targetNodeId}`}
                        onmouseenter={() => (hoveredTargetNodeId = targetNodeId)}
                        onmouseleave={() => (hoveredTargetNodeId = undefined)}
                        onclick={() => chooseTargetNode(targetNodeId)}
                        onkeydown={(event) => onKeyboardActivate(event, () => chooseTargetNode(targetNodeId))}
                    />
                {/each}
            {/if}
        </g>
    {/if}
{/if}

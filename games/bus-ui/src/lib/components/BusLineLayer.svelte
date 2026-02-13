<script lang="ts">
    import { applyBusLineSegment, isBusNodeId, type BusLineSegment, type BusNodeId } from '@tabletop/bus'
    import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'
    import {
        ROUTE_OUTLINE_WIDTH,
        ROUTE_STROKE_WIDTH,
        computeBusRouteRenderLayers,
        type BusRouteDefinition,
        type RouteRenderLayer
    } from '$lib/definitions/busLineRender.js'
    import { BusLinePlacementRenderAnimator } from '$lib/animators/busLinePlacementRenderAnimator.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import type { BusGameSession } from '$lib/model/session.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession() as BusGameSession

    const BOARD_WIDTH = 1839
    const BOARD_HEIGHT = 1300

    const START_HIT_STROKE_WIDTH = 34
    const EXTENSION_HIT_STROKE_WIDTH = 34
    const TARGET_HIT_RADIUS = 28
    const TARGET_VISIBLE_RADIUS = 15
    const SOURCE_VISIBLE_RADIUS = 16
    const NODE_HIGHLIGHT_OUTER_BORDER_WIDTH = 3
    const TARGET_HALO_RADIUS = TARGET_VISIBLE_RADIUS + 7
    const SOURCE_HALO_RADIUS = SOURCE_VISIBLE_RADIUS + 7
    const TARGET_OUTER_RADIUS = TARGET_VISIBLE_RADIUS + NODE_HIGHLIGHT_OUTER_BORDER_WIDTH / 2
    const SOURCE_OUTER_RADIUS = SOURCE_VISIBLE_RADIUS + NODE_HIGHLIGHT_OUTER_BORDER_WIDTH / 2

    let hoveredStartingSegmentKey = $state<string | undefined>()
    let hoveredExtensionSegmentKey = $state<string | undefined>()
    let hoveredTargetNodeId = $state<BusNodeId | undefined>()
    let hoveredSourceNodeId = $state<BusNodeId | undefined>()
    let animatedBusLineOverrides: Map<string, BusNodeId[]> | undefined = $derived.by(() => {
        // Writable derived override: can be assigned pre-state-change by animator,
        // then automatically resets when gameState reactively updates.
        gameSession.gameState
        return undefined
    })

    const canInteract = $derived.by(() => !gameSession.isViewingHistory && gameSession.canPlaceBusLine)
    const isStartingPlacement = $derived.by(
        () => canInteract && gameSession.myBusLineNodeIds.length === 0
    )
    const pendingTargetNodeId = $derived.by(() => gameSession.pendingBusLineTargetNodeId)

    const effectiveHoveredStartingSegmentKey = $derived.by(() => {
        if (!canInteract || !isStartingPlacement || !hoveredStartingSegmentKey) {
            return undefined
        }

        return gameSession.startingBusLineSegments.some(
            (segment) => startSegmentKey(segment) === hoveredStartingSegmentKey
        )
            ? hoveredStartingSegmentKey
            : undefined
    })

    const effectiveHoveredTargetNodeId = $derived.by(() => {
        if (!canInteract || pendingTargetNodeId || !hoveredTargetNodeId) {
            return undefined
        }

        return gameSession.selectableBusLineTargetNodeIds.includes(hoveredTargetNodeId)
            ? hoveredTargetNodeId
            : undefined
    })

    const effectiveHoveredExtensionSegment: BusLineSegment | undefined = $derived.by(() => {
        if (!canInteract || isStartingPlacement || !hoveredExtensionSegmentKey) {
            return undefined
        }

        return gameSession.extensionBusLineSegments.find(
            (segment) => segmentKey(segment) === hoveredExtensionSegmentKey
        )
    })

    const effectiveHoveredSourceNodeId = $derived.by(() => {
        if (!canInteract || !pendingTargetNodeId || !hoveredSourceNodeId) {
            return undefined
        }

        return gameSession.pendingBusLineSourceNodeIds.includes(hoveredSourceNodeId)
            ? hoveredSourceNodeId
            : undefined
    })

    const previewSegment: BusLineSegment | undefined = $derived.by(() => {
        if (!canInteract) {
            return undefined
        }

        const lineNodeIds = gameSession.myBusLineNodeIds
        if (lineNodeIds.length === 0) {
            if (!effectiveHoveredStartingSegmentKey) {
                return undefined
            }

            return gameSession.startingBusLineSegments.find(
                (segment) => startSegmentKey(segment) === effectiveHoveredStartingSegmentKey
            )
        }

        if (effectiveHoveredExtensionSegment) {
            return effectiveHoveredExtensionSegment
        }

        if (pendingTargetNodeId) {
            if (!effectiveHoveredSourceNodeId) {
                return undefined
            }

            return gameSession.segmentForSourceAndTargetNode(
                effectiveHoveredSourceNodeId,
                pendingTargetNodeId
            )
        }

        if (!effectiveHoveredTargetNodeId) {
            return undefined
        }

        return gameSession.unambiguousSegmentForTargetNode(effectiveHoveredTargetNodeId)
    })

    const previewBusLineNodeIds: BusNodeId[] | undefined = $derived.by(() => {
        if (!previewSegment) {
            return undefined
        }

        const previewLine = applyBusLineSegment(gameSession.myBusLineNodeIds, previewSegment)
        if (!previewLine) {
            return undefined
        }

        return previewLine
    })

    const busLinePlacementRenderAnimator = new BusLinePlacementRenderAnimator(gameSession, {
        onStart: (overrides) => {
            animatedBusLineOverrides = overrides
        }
    })

    function buildRouteDefinitions(
        myPreviewLineNodeIds?: BusNodeId[],
        playerLineOverrides?: ReadonlyMap<string, BusNodeId[]>
    ): BusRouteDefinition[] {
        const routes: BusRouteDefinition[] = []
        const previewPlayerId = gameSession.myPlayer?.id

        for (const playerState of gameSession.gameState.players) {
            const playerId = playerState.playerId
            const nodeIds: BusNodeId[] =
                playerLineOverrides?.get(playerId) ??
                (myPreviewLineNodeIds && previewPlayerId === playerId
                    ? myPreviewLineNodeIds
                    : playerState.busLine.every(isBusNodeId)
                      ? [...playerState.busLine]
                      : [])

            if (nodeIds.length < 2) {
                continue
            }

            routes.push({
                id: playerId,
                color: gameSession.colors.getPlayerUiColor(playerId),
                nodeIds
            })
        }

        return routes
    }

    const routeDefinitions: BusRouteDefinition[] = $derived.by(() => {
        if (animatedBusLineOverrides) {
            return buildRouteDefinitions(undefined, animatedBusLineOverrides)
        }
        return buildRouteDefinitions(previewBusLineNodeIds)
    })

    const routeRenderLayers = $derived.by(() => {
        return computeBusRouteRenderLayers(routeDefinitions)
    })

    const ambiguousPreviewTargetNodeId = $derived.by(() => {
        if (effectiveHoveredExtensionSegment) {
            return undefined
        }

        if (pendingTargetNodeId) {
            return pendingTargetNodeId
        }

        if (
            effectiveHoveredTargetNodeId &&
            gameSession.isAmbiguousBusLineTargetNode(effectiveHoveredTargetNodeId)
        ) {
            return effectiveHoveredTargetNodeId
        }

        return undefined
    })
    const ambiguousPreviewLayers: RouteRenderLayer[] = $derived.by(() => {
        const targetNodeId = ambiguousPreviewTargetNodeId
        const myPlayerId = gameSession.myPlayer?.id
        if (!targetNodeId || !myPlayerId) {
            return []
        }

        // While confirming source for a chosen ambiguous target, show only the resolved single preview.
        if (pendingTargetNodeId && effectiveHoveredSourceNodeId) {
            return []
        }

        const segments = gameSession.segmentOptionsForTargetNode(targetNodeId)
        if (segments.length <= 1) {
            return []
        }

        const layers: RouteRenderLayer[] = []
        for (const segment of segments) {
            const previewLine = applyBusLineSegment(gameSession.myBusLineNodeIds, segment)
            if (!previewLine) {
                continue
            }

            const previewRoutes = buildRouteDefinitions(previewLine)
            const myPreviewLayer = computeBusRouteRenderLayers(previewRoutes).find(
                (layer) => layer.id === myPlayerId
            )
            if (myPreviewLayer) {
                layers.push(myPreviewLayer)
            }
        }

        return layers
    })

    function startSegmentKey(segment: BusLineSegment): string {
        return segmentKey(segment)
    }

    function segmentKey(segment: BusLineSegment): string {
        return `${segment[0]}:${segment[1]}`
    }

    function clearHoverState() {
        hoveredStartingSegmentKey = undefined
        hoveredExtensionSegmentKey = undefined
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

    async function chooseExtensionSegment(segment: BusLineSegment) {
        await gameSession.placeBusLineSegment(segment)
        clearHoverState()
    }
</script>

<svg
    class="pointer-events-none absolute inset-0 z-[1] h-full w-full"
    viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
    aria-label="Bus lines"
>
    <g class="pointer-events-none" {@attach attachAnimator(busLinePlacementRenderAnimator)}></g>
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

        {#each ambiguousPreviewLayers as layer, previewIndex (`${layer.id}:${previewIndex}`)}
            <g opacity="0.6">
                {#each layer.segments as segment (`${segment.key}:ambiguous-outline`)}
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

                {#each layer.connectors as connector (`${connector.key}:ambiguous-outline`)}
                    <path
                        d={connector.d}
                        stroke="#020617"
                        stroke-width={ROUTE_STROKE_WIDTH + ROUTE_OUTLINE_WIDTH * 2}
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        fill="none"
                    />
                {/each}

                {#each layer.segments as segment (`${segment.key}:ambiguous-fill`)}
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

                {#each layer.connectors as connector (`${connector.key}:ambiguous-fill`)}
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
            </g>
        {/each}
    </g>
</svg>

<svg
    class="pointer-events-none absolute inset-0 z-[3] h-full w-full"
    viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
    aria-label="Bus line selection overlay"
>
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
                        class="cursor-pointer bus-line-hit-target"
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
                {#each gameSession.extensionBusLineSegments as segment, segmentIndex (`${segmentKey(segment)}:${segmentIndex}`)}
                    {@const fromPoint = BUS_BOARD_NODE_POINTS[segment[0]]}
                    {@const toPoint = BUS_BOARD_NODE_POINTS[segment[1]]}
                    <line
                        x1={fromPoint.x}
                        y1={fromPoint.y}
                        x2={toPoint.x}
                        y2={toPoint.y}
                        stroke="transparent"
                        stroke-width={EXTENSION_HIT_STROKE_WIDTH}
                        stroke-linecap="round"
                        class="cursor-pointer bus-line-hit-target"
                        role="button"
                        tabindex="0"
                        aria-label={`Place segment ${segment[0]} to ${segment[1]}`}
                        onmouseenter={() => (hoveredExtensionSegmentKey = segmentKey(segment))}
                        onmouseleave={() => {
                            if (hoveredExtensionSegmentKey === segmentKey(segment)) {
                                hoveredExtensionSegmentKey = undefined
                            }
                        }}
                        onclick={() => chooseExtensionSegment(segment)}
                        onkeydown={(event) =>
                            onKeyboardActivate(event, () => chooseExtensionSegment(segment))}
                    />
                {/each}

                {#if pendingTargetNodeId}
                    {@const pendingPoint = BUS_BOARD_NODE_POINTS[pendingTargetNodeId]}
                    <circle
                        cx={pendingPoint.x}
                        cy={pendingPoint.y}
                        r={TARGET_HALO_RADIUS + 1}
                        fill="none"
                        stroke="#fba01c"
                        stroke-width="6"
                        opacity="0.34"
                        pointer-events="none"
                        style="transition: opacity 120ms ease-out;"
                    />
                    <circle
                        cx={pendingPoint.x}
                        cy={pendingPoint.y}
                        r={TARGET_OUTER_RADIUS}
                        fill="none"
                        stroke="#ffffff"
                        stroke-width="4"
                        opacity="0.95"
                        pointer-events="none"
                        style="transition: stroke 120ms ease-out, stroke-width 120ms ease-out;"
                    />
                    <circle
                        cx={pendingPoint.x}
                        cy={pendingPoint.y}
                        r={TARGET_VISIBLE_RADIUS}
                        fill="#f9c95a"
                        stroke="#f9c95a"
                        stroke-width="3"
                        pointer-events="none"
                        style="transition: fill 120ms ease-out, stroke 120ms ease-out;"
                    />

                    {#each gameSession.pendingBusLineSourceNodeIds as sourceNodeId (sourceNodeId)}
                        {@const sourcePoint = BUS_BOARD_NODE_POINTS[sourceNodeId]}
                        {@const isSourceHovered = effectiveHoveredSourceNodeId === sourceNodeId}
                        <circle
                            cx={sourcePoint.x}
                            cy={sourcePoint.y}
                            r={SOURCE_HALO_RADIUS}
                            fill="none"
                            stroke="#0c66b4"
                            stroke-width={isSourceHovered ? 6 : 5}
                            opacity={isSourceHovered ? 0.32 : 0.22}
                            pointer-events="none"
                            style="transition: opacity 120ms ease-out, stroke-width 120ms ease-out;"
                        />
                        <circle
                            cx={sourcePoint.x}
                            cy={sourcePoint.y}
                            r={SOURCE_OUTER_RADIUS}
                            fill="none"
                            stroke={isSourceHovered ? '#ffffff' : '#333'}
                            stroke-width={isSourceHovered ? NODE_HIGHLIGHT_OUTER_BORDER_WIDTH + 1 : NODE_HIGHLIGHT_OUTER_BORDER_WIDTH}
                            opacity="0.95"
                            pointer-events="none"
                            style="transition: stroke 120ms ease-out, stroke-width 120ms ease-out;"
                        />
                        <circle
                            cx={sourcePoint.x}
                            cy={sourcePoint.y}
                            r={SOURCE_VISIBLE_RADIUS}
                            fill={isSourceHovered ? '#5f9fd8' : '#3f86c6'}
                            stroke={isSourceHovered ? '#5f9fd8' : '#3f86c6'}
                            stroke-width="3"
                            pointer-events="none"
                            style="transition: fill 120ms ease-out, stroke 120ms ease-out;"
                        />
                        <circle
                            cx={sourcePoint.x}
                            cy={sourcePoint.y}
                            r={TARGET_HIT_RADIUS}
                            fill="transparent"
                            class="cursor-pointer bus-line-hit-target"
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
                        {@const isHovered = effectiveHoveredTargetNodeId === targetNodeId}
                        <circle
                            cx={point.x}
                            cy={point.y}
                            r={TARGET_HALO_RADIUS}
                            fill="none"
                            stroke={isAmbiguous ? '#fba01c' : '#facc15'}
                            stroke-width={isHovered ? 6 : 5}
                            opacity={isHovered ? 0.3 : isAmbiguous ? 0.18 : 0.12}
                            pointer-events="none"
                            style="transition: opacity 120ms ease-out, stroke-width 120ms ease-out, stroke 120ms ease-out;"
                        />
                        <circle
                            cx={point.x}
                            cy={point.y}
                            r={TARGET_OUTER_RADIUS}
                            fill="none"
                            stroke={isHovered ? '#ffffff' : '#333'}
                            stroke-width={isHovered ? NODE_HIGHLIGHT_OUTER_BORDER_WIDTH + 1 : NODE_HIGHLIGHT_OUTER_BORDER_WIDTH}
                            opacity="0.95"
                            pointer-events="none"
                            style="transition: stroke 120ms ease-out, stroke-width 120ms ease-out;"
                        />
                        <circle
                            cx={point.x}
                            cy={point.y}
                            r={TARGET_VISIBLE_RADIUS}
                            fill={isHovered ? '#fff27a' : isAmbiguous ? '#f9c95a' : '#f5ea6e'}
                            stroke={isHovered ? '#fff27a' : isAmbiguous ? '#f9c95a' : '#f5ea6e'}
                            stroke-width="3"
                            pointer-events="none"
                            style="transition: fill 120ms ease-out, stroke 120ms ease-out;"
                        />
                        <circle
                            cx={point.x}
                            cy={point.y}
                            r={TARGET_HIT_RADIUS}
                            fill="transparent"
                            class="cursor-pointer bus-line-hit-target"
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
</svg>

<style>
    .bus-line-hit-target:focus {
        outline: none;
    }

    .bus-line-hit-target:focus-visible {
        outline: 2.5px solid #fff27a;
        outline-offset: 2px;
    }
</style>

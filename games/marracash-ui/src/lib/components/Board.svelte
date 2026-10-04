<script lang="ts">
    import { onDestroy } from 'svelte'
    import { BoardColumns, BoardRows, Palms } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShopTile from '$lib/components/ShopTile.svelte'
    import AwningDefs from '$lib/components/AwningDefs.svelte'
    import CobbleDefs from '$lib/components/CobbleDefs.svelte'
    import PawnDefs from '$lib/components/PawnDefs.svelte'
    import FountainDefs from '$lib/components/FountainDefs.svelte'
    import FountainSpot from '$lib/components/FountainSpot.svelte'
    import RoutePreview from '$lib/components/RoutePreview.svelte'
    import HistoryHighlight from '$lib/components/HistoryHighlight.svelte'
    import VisitorQueue from '$lib/components/VisitorQueue.svelte'
    import PalmTree from '$lib/components/PalmTree.svelte'
    import Pawn from '$lib/components/Pawn.svelte'
    import { animateWalker, VisitorMoveAnimator } from '$lib/animators/visitorMoveAnimator.js'
    import { FountainPawnSize } from '$lib/utils/fountainPawns.js'
    import CityWall from '$lib/components/CityWall.svelte'
    import CityGates from '$lib/components/CityGates.svelte'
    import type { FountainId, FountainState, Route, ShopVisit } from '@tabletop/marracash'
    import {
        BoardHeight,
        BoardWidth,
        CellSize,
        QueueMargin,
        CandidateHaloFilterId,
        CastShadowFilterId,
        LineHaloFilterId,
        TableHeight,
        TableWidth,
        WallThickness
    } from '$lib/utils/boardGeometry.js'
    import { CobblePatternId } from '$lib/utils/cobbles.js'

    const gameSession = getGameSession()

    const visitorMoveAnimator = new VisitorMoveAnimator(gameSession)
    visitorMoveAnimator.register()
    onDestroy(() => visitorMoveAnimator.unregister())

    let spotlightShopId = $derived(
        gameSession.gameState.auctionShopId ?? gameSession.selectedShopId
    )
    let spotlightShop = $derived(
        gameSession.visibleShops.find((shop) => shop.shopId === spotlightShopId)
    )

    let liftedFountainIds: FountainId[] = $derived(
        gameSession.selectedFountainId === undefined
            ? gameSession.refillEntranceIds
            : [gameSession.selectedFountainId, ...gameSession.destinationFountainIds]
    )
    let queueLifted = $derived(gameSession.refillEntranceIds.length > 0)
    let liftedFountains = $derived(
        gameSession.visibleFountains.filter((fountain) =>
            liftedFountainIds.includes(fountain.fountainId)
        )
    )
    let groundFountains = $derived(
        gameSession.visibleFountains.filter(
            (fountain) => !liftedFountainIds.includes(fountain.fountainId)
        )
    )
    let dimmed = $derived(spotlightShop !== undefined || liftedFountains.length > 0)

    let hoveredRoute = $derived.by<Route | undefined>(() => {
        gameSession.updatingVisibleState
        gameSession.selectedFountainId
        return undefined
    })
    let shownRoute = $derived(gameSession.previewedRoute ?? hoveredRoute)
    let previewRoute = $derived(
        !gameSession.updatingVisibleState &&
            shownRoute !== undefined &&
            shownRoute.from === gameSession.selectedFountainId
            ? shownRoute
            : undefined
    )

    let previewVisits: readonly ShopVisit[] = $derived(
        previewRoute === undefined ? [] : gameSession.gameState.visitsAlong(previewRoute).visits
    )
    let enteredShops = $derived(
        gameSession.visibleShops.filter((shop) =>
            previewVisits.some((visit) => visit.shopId === shop.shopId)
        )
    )
    let groundShops = $derived(
        gameSession.visibleShops.filter(
            (shop) => shop !== spotlightShop && !enteredShops.includes(shop)
        )
    )

    function previewDestination(destinationId: FountainId, previewing: boolean) {
        hoveredRoute = previewing
            ? gameSession.selectedRoutes.find((route) => route.to === destinationId)
            : undefined
    }

    function fountainLabel(
        fountainId: FountainId,
        isSource: boolean,
        isDestination: boolean
    ): string | undefined {
        if (isSource) return `Keep the visitors at fountain ${fountainId}`
        if (isDestination && gameSession.usesTouch)
            return `Show the route to fountain ${fountainId}`
        if (isDestination) return `Move visitors to fountain ${fountainId}`
        return undefined
    }

    function chooseFountain(fountainId: FountainId) {
        if (gameSession.fillableEntranceIds.includes(fountainId)) {
            void gameSession.bringVisitorsTo(fountainId)
        } else if (gameSession.selectedFountainId === fountainId) {
            gameSession.back()
        } else if (gameSession.destinationFountainIds.includes(fountainId)) {
            if (gameSession.usesTouch) gameSession.previewDestination(fountainId)
            else void gameSession.moveVisitorsTo(fountainId)
        } else {
            gameSession.selectFountain(fountainId)
        }
    }
</script>

{#snippet fountainSpot(fountain: FountainState)}
    {@const isSource = gameSession.selectedFountainId === fountain.fountainId}
    {@const isDestination = gameSession.destinationFountainIds.includes(fountain.fountainId)}
    {@const selectable =
        isSource ||
        isDestination ||
        gameSession.movableFountainIds.includes(fountain.fountainId) ||
        gameSession.fillableEntranceIds.includes(fountain.fountainId)}
    <FountainSpot
        {fountain}
        {selectable}
        highlighted={selectable || gameSession.refillEntranceIds.includes(fountain.fountainId)}
        selected={isSource}
        destination={previewRoute?.to === fountain.fountainId}
        label={fountainLabel(fountain.fountainId, isSource, isDestination)}
        onselect={() => chooseFountain(fountain.fountainId)}
        onpreview={isDestination
            ? (previewing) => previewDestination(fountain.fountainId, previewing)
            : undefined}
    />
{/snippet}

<div class="relative" style:width="{TableWidth}px" style:height="{TableHeight}px">
    <svg width={TableWidth} height={TableHeight} viewBox="0 0 {TableWidth} {TableHeight}">
        <defs>
            <filter id={CandidateHaloFilterId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="glow"></feGaussianBlur>
                <feMerge>
                    <feMergeNode in="glow"></feMergeNode>
                    <feMergeNode in="glow"></feMergeNode>
                    <feMergeNode in="SourceGraphic"></feMergeNode>
                </feMerge>
            </filter>
            <filter
                id={LineHaloFilterId}
                filterUnits="userSpaceOnUse"
                x="0"
                y="0"
                width={BoardWidth}
                height={BoardHeight}
            >
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="glow"></feGaussianBlur>
                <feMerge>
                    <feMergeNode in="glow"></feMergeNode>
                    <feMergeNode in="glow"></feMergeNode>
                    <feMergeNode in="SourceGraphic"></feMergeNode>
                </feMerge>
            </filter>
            <filter id={CastShadowFilterId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5"></feGaussianBlur>
            </filter>
            <AwningDefs />
            <CobbleDefs />
            <PawnDefs />
            <FountainDefs />
        </defs>
        {#if !queueLifted}
            <VisitorQueue />
        {/if}
        <g
            role="img"
            aria-label="MarraCash market"
            transform="translate({QueueMargin} {QueueMargin})"
        >
            <CityWall />
            <rect
                x={WallThickness}
                y={WallThickness}
                width={BoardColumns * CellSize}
                height={BoardRows * CellSize}
                fill="url(#{CobblePatternId})"
            ></rect>

            <CityGates />

            {#each Palms as palm (`${palm.row},${palm.col}`)}
                <PalmTree coords={palm} />
            {/each}

            {#each groundShops as shop (shop.shopId)}
                <ShopTile
                    {shop}
                    selectable={gameSession.auctionableShopIds.includes(shop.shopId)}
                />
            {/each}

            {#each groundFountains as fountain (fountain.fountainId)}
                {@render fountainSpot(fountain)}
            {/each}

            {#if dimmed}
                <rect
                    x={-QueueMargin}
                    y={-QueueMargin}
                    width={TableWidth}
                    height={TableHeight}
                    fill="#000000"
                    opacity="0.5"
                ></rect>
            {/if}

            {#if spotlightShop}
                <ShopTile shop={spotlightShop} selectable={false} spotlit />
            {/if}

            {#each enteredShops as shop (shop.shopId)}
                <ShopTile {shop} selectable={false} />
            {/each}

            {#each liftedFountains as fountain (fountain.fountainId)}
                {@render fountainSpot(fountain)}
            {/each}

            {#if previewRoute}
                <!-- Remount per route so its dashes start in step with the destination's pulse. -->
                {#key previewRoute}
                    <RoutePreview route={previewRoute} visits={previewVisits} />
                {/key}
            {/if}

            {#if gameSession.historyHighlight}
                <HistoryHighlight highlight={gameSession.historyHighlight} />
            {/if}
        </g>
        {#if queueLifted}
            <VisitorQueue />
        {/if}
    </svg>
    <!-- Walking pawns get their own composited layer, so moving them never repaints the
     filter-heavy board beneath. -->
    <svg
        class="walker-layer pointer-events-none absolute top-0 left-0"
        width={TableWidth}
        height={TableHeight}
        viewBox="0 0 {TableWidth} {TableHeight}"
        aria-hidden="true"
    >
        <g transform="translate({QueueMargin} {QueueMargin})">
            {#each gameSession.movingVisitors as walker (walker.id)}
                <g opacity="0" use:animateWalker={{ animator: visitorMoveAnimator, id: walker.id }}>
                    <Pawn color={walker.color} x={0} y={0} size={FountainPawnSize} />
                </g>
            {/each}
        </g>
    </svg>
</div>

<style>
    .walker-layer {
        will-change: transform;
    }
</style>

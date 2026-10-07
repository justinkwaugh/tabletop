<script lang="ts">
    import { PillarShadowOffset, Towers } from '$lib/utils/cityWall.js'
    import { onDestroy } from 'svelte'
    import { BoardColumns, BoardRows, getFountain, Palms } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShopTile from '$lib/components/ShopTile.svelte'
    import StallDefs from '$lib/components/StallDefs.svelte'
    import GroundDefs from '$lib/components/GroundDefs.svelte'
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
    import StreetWear from '$lib/components/StreetWear.svelte'
    import EarningsPopupLayer from '$lib/components/EarningsPopupLayer.svelte'
    import HaloRing from '$lib/components/HaloRing.svelte'
    import { stallOutline } from '$lib/utils/stalls.js'
    import { fountainBounds, fountainOutline } from '$lib/utils/fountainShape.js'
    import type { FountainId, FountainState, Route, ShopVisit } from '@tabletop/marracash'
    import {
        BoardHeight,
        BoardWidth,
        CellSize,
        cellCenter,
        shopRect,
        ShopTileInset,
        QueueMargin,
        CandidateHaloFilterId,
        CastShadowFilterId,
        LineHaloFilterId,
        TableDisplayScale,
        TableHeight,
        TableWidth,
        WallThickness
    } from '$lib/utils/boardGeometry.js'
    import { PackedEarthPatternId } from '$lib/utils/ground.js'

    const gameSession = getGameSession()
    const DisplayWidth = TableWidth * TableDisplayScale
    const DisplayHeight = TableHeight * TableDisplayScale

    const visitorMoveAnimator = new VisitorMoveAnimator(gameSession)
    visitorMoveAnimator.register()
    onDestroy(() => visitorMoveAnimator.unregister())

    let spotlightShopId = $derived(gameSession.gameState.auction?.shopId)
    let spotlightShop = $derived(
        gameSession.visibleShops.find((shop) => shop.shopId === spotlightShopId)
    )

    let liftedFountainIds: FountainId[] = $derived(
        gameSession.selectedFountainId === undefined
            ? gameSession.refillEntranceIds
            : [gameSession.selectedFountainId, ...gameSession.destinationFountainIds]
    )
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
    let fountainsAboveDimming = $derived(spotlightShop !== undefined)

    let hoveredRoute = $derived.by<Route | undefined>(() => {
        gameSession.updatingVisibleState
        gameSession.selectedFountainId
        return undefined
    })
    let previewRoute = $derived(
        !gameSession.updatingVisibleState &&
            hoveredRoute !== undefined &&
            hoveredRoute.from === gameSession.selectedFountainId
            ? hoveredRoute
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
    let choosableShops = $derived(
        dimmed
            ? []
            : gameSession.visibleShops.filter((shop) =>
                  gameSession.auctionableShopIds.includes(shop.shopId)
              )
    )
    let choosableFountains = $derived(
        dimmed
            ? []
            : gameSession.visibleFountains.filter((fountain) =>
                  gameSession.movableFountainIds.includes(fountain.fountainId)
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
        if (isDestination) return `Move visitors to fountain ${fountainId}`
        return undefined
    }

    function chooseFountain(fountainId: FountainId) {
        if (gameSession.fillableEntranceIds.includes(fountainId)) {
            void gameSession.bringVisitorsTo(fountainId)
        } else if (gameSession.selectedFountainId === fountainId) {
            gameSession.selectFountain(undefined)
        } else if (gameSession.destinationFountainIds.includes(fountainId)) {
            void gameSession.moveVisitorsTo(fountainId)
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

<div
    class="relative"
    role="img"
    aria-label="MarraCash market"
    style:width="{DisplayWidth}px"
    style:height="{DisplayHeight}px"
>
    <svg width={DisplayWidth} height={DisplayHeight} viewBox="0 0 {TableWidth} {TableHeight}">
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
            <StallDefs />
            <GroundDefs />
            <PawnDefs />
            <FountainDefs />
        </defs>
        <g transform="translate({QueueMargin} {QueueMargin})">
            <CityWall />
            <rect
                x={WallThickness}
                y={WallThickness}
                width={BoardColumns * CellSize}
                height={BoardRows * CellSize}
                fill="url(#{PackedEarthPatternId})"
            ></rect>
            <StreetWear />

            <CityGates groundFill="url(#{PackedEarthPatternId})" />

            {#each Palms as palm (`${palm.row},${palm.col}`)}
                <PalmTree coords={palm} />
            {/each}

            {#each gameSession.visibleShops as shop (shop.shopId)}
                <ShopTile {shop} layer="awning" />
            {/each}

            {#each gameSession.visibleFountains as fountain (fountain.fountainId)}
                <FountainSpot
                    {fountain}
                    selectable={false}
                    highlighted={false}
                    selected={false}
                    halo={false}
                    onselect={() => {}}
                    layer="basin"
                />
            {/each}
        </g>
    </svg>
    <!-- Everything that changes with play (signs, visitors, halos, the overlay and the pieces
     raised above it, the queue) lives on its own composited layer above a board that never
     changes, so dimming, choosing or a new state repaints only this layer. -->
    <svg
        class="raised-layer pointer-events-none absolute top-0 left-0"
        width={DisplayWidth}
        height={DisplayHeight}
        viewBox="0 0 {TableWidth} {TableHeight}"
    >
        <g transform="translate({QueueMargin} {QueueMargin})">
            <!-- The board beneath holds no controls, so becoming choosable never repaints it -->
            {#each choosableShops as shop (shop.shopId)}
                {@const rect = shopRect(shop.shopId, ShopTileInset)}
                {@const outline = stallOutline(shop.shopId, rect.width, rect.height)}
                <g
                    role="button"
                    tabindex="0"
                    aria-label="Auction shop {shop.shopId}"
                    class="cursor-pointer"
                    pointer-events="auto"
                    transform="translate({rect.x} {rect.y})"
                    onclick={() => gameSession.startAuction(shop.shopId)}
                    onkeydown={(event) =>
                        event.key === 'Enter' && gameSession.startAuction(shop.shopId)}
                >
                    <HaloRing
                        id="marracash-shop-halo-{shop.shopId}"
                        {outline}
                        bounds={{ x: 0, y: 0, width: rect.width, height: rect.height }}
                    />
                    <path d={outline} fill="transparent"></path>
                </g>
            {/each}
            {#each choosableFountains as fountain (fountain.fountainId)}
                {@const definition = getFountain(fountain.fountainId)}
                {@const center = cellCenter(definition.coords)}
                <g
                    role="button"
                    tabindex="0"
                    aria-label="Fountain {fountain.fountainId}"
                    class="cursor-pointer"
                    pointer-events="auto"
                    onclick={() => chooseFountain(fountain.fountainId)}
                    onkeydown={(event) =>
                        event.key === 'Enter' && chooseFountain(fountain.fountainId)}
                >
                    <HaloRing
                        id="marracash-fountain-halo-{fountain.fountainId}"
                        outline={fountainOutline(center, definition.entrance)}
                        bounds={fountainBounds(center, definition.entrance)}
                    />
                    <rect
                        x={center.x - CellSize / 2}
                        y={center.y - CellSize / 2}
                        width={CellSize}
                        height={CellSize}
                        fill="transparent"
                    ></rect>
                </g>
            {/each}

            {#if dimmed}
                <!-- One group opacity, so the pillars' overlap with the wall is not darkened twice -->
                <g opacity="0.25" pointer-events="auto">
                    <rect width={BoardWidth} height={BoardHeight} fill="#000000"></rect>
                    {#each Towers as pillar (`${pillar.x},${pillar.y}`)}
                        {#each [{ x: 0, y: 0 }, PillarShadowOffset] as offset (offset)}
                            <rect
                                x={pillar.x + offset.x}
                                y={pillar.y + offset.y}
                                width={pillar.width}
                                height={pillar.height}
                                rx="2"
                                fill="#000000"
                            ></rect>
                        {/each}
                    {/each}
                </g>
            {/if}

            {#each groundShops as shop (shop.shopId)}
                <ShopTile {shop} layer="sign" />
            {/each}
            {#each groundFountains as fountain (fountain.fountainId)}
                {#if fountainsAboveDimming}
                    <g pointer-events="auto">{@render fountainSpot(fountain)}</g>
                {:else}
                    <FountainSpot
                        {fountain}
                        selectable={false}
                        selected={false}
                        onselect={() => {}}
                        layer="visitors"
                    />
                {/if}
            {/each}

            <g pointer-events="auto">
                {#if spotlightShop}
                    <ShopTile shop={spotlightShop} spotlit />
                {/if}

                {#each enteredShops as shop (shop.shopId)}
                    <ShopTile {shop} />
                {/each}

                {#each liftedFountains as fountain (fountain.fountainId)}
                    {@render fountainSpot(fountain)}
                {/each}
            </g>

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
        <g pointer-events="auto"><VisitorQueue /></g>
    </svg>
    <!-- Walking pawns get their own composited layer, so moving them never repaints the
     filter-heavy board beneath. -->
    <svg
        class="walker-layer pointer-events-none absolute top-0 left-0"
        width={DisplayWidth}
        height={DisplayHeight}
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
    <div
        class="pointer-events-none absolute top-0 left-0 origin-top-left"
        style:width="{TableWidth}px"
        style:height="{TableHeight}px"
        style:transform="scale({TableDisplayScale})"
    >
        <EarningsPopupLayer earnings={visitorMoveAnimator.earnings} />
    </div>
</div>

<style>
    .raised-layer,
    .walker-layer {
        will-change: transform;
    }
</style>

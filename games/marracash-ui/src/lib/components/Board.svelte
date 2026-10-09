<script lang="ts">
    import { PillarShadowOffset, Towers } from '$lib/utils/cityWall.js'
    import { onDestroy } from 'svelte'
    import { BoardColumns, BoardRows, getFountain, Palms } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShopTile from '$lib/components/ShopTile.svelte'
    import StallDefs from '$lib/components/StallDefs.svelte'
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
        TableHeight,
        TableWidth,
        WallThickness
    } from '$lib/utils/boardGeometry.js'
    import { PackedEarthColor } from '$lib/utils/ground.js'

    const gameSession = getGameSession()

    // A walking pawn's box, centred on where it stands, holds the figure and its ground shadow.
    const WalkerBox = 32

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
    let dimmed = $derived(spotlightShop !== undefined || liftedFountains.length > 0)
    // During an auction every fountain stays above the overlay.
    let raisedFountainIds: FountainId[] = $derived(
        spotlightShop !== undefined
            ? gameSession.visibleFountains.map((fountain) => fountain.fountainId)
            : liftedFountainIds
    )

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

<!-- A hidden copy is never a control, so it has no role, label or tab stop. -->
{#snippet fountainSpot(fountain: FountainState, shown: boolean)}
    {@const isSource = gameSession.selectedFountainId === fountain.fountainId}
    {@const isDestination = gameSession.destinationFountainIds.includes(fountain.fountainId)}
    {@const selectable =
        shown &&
        (isSource ||
            isDestination ||
            gameSession.movableFountainIds.includes(fountain.fountainId) ||
            gameSession.fillableEntranceIds.includes(fountain.fountainId))}
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
    style:width="{TableWidth}px"
    style:height="{TableHeight}px"
>
    <svg width={TableWidth} height={TableHeight} viewBox="0 0 {TableWidth} {TableHeight}">
        <defs>
            <StallDefs />
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
                fill={PackedEarthColor}
            ></rect>
            <StreetWear />

            <CityGates groundFill={PackedEarthColor} />

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
        <!-- Everything that changes with play (signs, visitors, halos, the overlay and the pieces
         raised above it, the queue) is drawn above the ground in the same SVG, so the board is
         one bitmap; only its controls take the pointer. -->
        <g pointer-events="none">
            <g transform="translate({QueueMargin} {QueueMargin})">
                <!-- Each block that mounts or unmounts pieces has a group of its own: in WebKit a
                 piece mounted among many siblings is slower to restyle and lay out. -->
                <g>
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
                </g>
                <g>
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
                </g>

                <g>
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
                </g>

                <g>
                    {#each groundShops as shop (shop.shopId)}
                        <ShopTile {shop} layer="sign" />
                    {/each}
                </g>
                <!-- Every fountain is drawn both here and raised above the overlay, and raising one
                 only swaps which is visible: in WebKit mounting a fountain's basin into the board
                 restyles and repaints it, about ten times as slow as the swap. A hidden copy cannot
                 be focused or clicked and is left out of the accessibility tree. -->
                {#each gameSession.visibleFountains as fountain (fountain.fountainId)}
                    <g
                        visibility={raisedFountainIds.includes(fountain.fountainId)
                            ? 'hidden'
                            : undefined}
                    >
                        <FountainSpot
                            {fountain}
                            selectable={false}
                            selected={false}
                            onselect={() => {}}
                            layer="visitors"
                        />
                    </g>
                {/each}

                <g pointer-events="auto">
                    <g>
                        {#if spotlightShop}
                            <ShopTile shop={spotlightShop} spotlit />
                        {/if}
                    </g>

                    <g>
                        {#each enteredShops as shop (shop.shopId)}
                            <ShopTile {shop} />
                        {/each}
                    </g>

                    {#each gameSession.visibleFountains as fountain (fountain.fountainId)}
                        {@const shown = raisedFountainIds.includes(fountain.fountainId)}
                        <g visibility={shown ? undefined : 'hidden'}>
                            {@render fountainSpot(fountain, shown)}
                        </g>
                    {/each}
                </g>

                <g>
                    {#if previewRoute}
                        <!-- Remount per route so its dashes start in step with the destination's pulse. -->
                        {#key previewRoute}
                            <RoutePreview route={previewRoute} visits={previewVisits} />
                        {/key}
                    {/if}
                </g>

                <g>
                    {#if gameSession.historyHighlight}
                        <HistoryHighlight highlight={gameSession.historyHighlight} />
                    {/if}
                </g>
            </g>
            <g pointer-events="auto"><VisitorQueue /></g>
        </g>
    </svg>
    <!-- Each walking pawn is its own small composited element, moved by a CSS transform, so a walk
     repaints nothing; the elements exist only while a move animates. -->
    <div
        class="walker-layer pointer-events-none absolute"
        style:left="{QueueMargin}px"
        style:top="{QueueMargin}px"
        aria-hidden="true"
    >
        {#each gameSession.movingVisitors as walker (walker.id)}
            <svg
                class="walker absolute"
                style:left="{-WalkerBox / 2}px"
                style:top="{-WalkerBox / 2}px"
                style:opacity="0"
                width={WalkerBox}
                height={WalkerBox}
                viewBox="{-WalkerBox / 2} {-WalkerBox / 2} {WalkerBox} {WalkerBox}"
                use:animateWalker={{ animator: visitorMoveAnimator, id: walker.id }}
            >
                <Pawn color={walker.color} x={0} y={0} size={FountainPawnSize} />
            </svg>
        {/each}
    </div>
    <EarningsPopupLayer earnings={visitorMoveAnimator.earnings} />
</div>

<style>
    .walker {
        will-change: transform;
    }
</style>

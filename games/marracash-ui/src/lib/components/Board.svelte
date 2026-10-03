<script lang="ts">
    import { BoardColumns, BoardRows, Fountains, Palms } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShopTile from '$lib/components/ShopTile.svelte'
    import AwningDefs from '$lib/components/AwningDefs.svelte'
    import CobbleDefs from '$lib/components/CobbleDefs.svelte'
    import PawnDefs from '$lib/components/PawnDefs.svelte'
    import FountainDefs from '$lib/components/FountainDefs.svelte'
    import FountainSpot from '$lib/components/FountainSpot.svelte'
    import RoutePreview from '$lib/components/RoutePreview.svelte'
    import VisitorQueue from '$lib/components/VisitorQueue.svelte'
    import PalmTree from '$lib/components/PalmTree.svelte'
    import {
        shopVisits,
        type FountainId,
        type FountainState,
        type Route,
        type ShopVisit
    } from '@tabletop/marracash'
    import {
        BoardHeight,
        BoardWidth,
        CellSize,
        cellCenter,
        gateRect,
        QueueMargin,
        CandidateHaloFilterId,
        LineHaloFilterId,
        TableHeight,
        TableWidth,
        WallThickness
    } from '$lib/utils/boardGeometry.js'
    import { CobblePatternId } from '$lib/utils/cobbles.js'
    import { SignShadowFilterId } from '$lib/utils/shopSign.js'

    const gameSession = getGameSession()

    let spotlightShopId = $derived(
        gameSession.gameState.auctionShopId ?? gameSession.selectedShopId
    )
    let spotlightShop = $derived(
        gameSession.gameState.shops.find((shop) => shop.shopId === spotlightShopId)
    )

    let liftedFountainIds: FountainId[] = $derived(
        gameSession.selectedFountainId === undefined
            ? []
            : [gameSession.selectedFountainId, ...gameSession.destinationFountainIds]
    )
    let liftedFountains = $derived(
        gameSession.gameState.fountains.filter((fountain) =>
            liftedFountainIds.includes(fountain.fountainId)
        )
    )
    let groundFountains = $derived(
        gameSession.gameState.fountains.filter(
            (fountain) => !liftedFountainIds.includes(fountain.fountainId)
        )
    )
    let dimmed = $derived(spotlightShop !== undefined || liftedFountains.length > 0)

    let hoveredRoute: Route | undefined = $state()
    let previewRoute = $derived(
        !gameSession.updatingVisibleState &&
            hoveredRoute !== undefined &&
            hoveredRoute.from === gameSession.selectedFountainId
            ? hoveredRoute
            : undefined
    )

    let previewVisits: readonly ShopVisit[] = $derived(
        previewRoute === undefined
            ? []
            : shopVisits(
                  previewRoute,
                  gameSession.gameState.getFountainState(previewRoute.from).visitors,
                  (shopId) => gameSession.gameState.getShopState(shopId).ownerId !== undefined
              ).visits
    )
    let enteredShops = $derived(
        gameSession.gameState.shops.filter((shop) =>
            previewVisits.some((visit) => visit.shopId === shop.shopId)
        )
    )
    let groundShops = $derived(
        gameSession.gameState.shops.filter(
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
        if (isDestination) return `Move visitors to fountain ${fountainId}`
        return undefined
    }

    function chooseFountain(fountainId: FountainId) {
        if (gameSession.fillableEntranceIds.includes(fountainId)) {
            void gameSession.bringVisitorsTo(fountainId)
        } else if (gameSession.selectedFountainId === fountainId) {
            gameSession.back()
        } else if (gameSession.destinationFountainIds.includes(fountainId)) {
            hoveredRoute = undefined
            void gameSession.moveVisitorsTo(fountainId)
        } else {
            gameSession.selectFountain(fountainId)
        }
    }

    const gates = Fountains.filter((fountain) => fountain.entrance).map((fountain) =>
        gateRect(fountain.coords)
    )
</script>

{#snippet fountainSpot(fountain: FountainState)}
    {@const isSource = gameSession.selectedFountainId === fountain.fountainId}
    {@const isDestination = gameSession.destinationFountainIds.includes(fountain.fountainId)}
    <FountainSpot
        {fountain}
        selectable={isSource ||
            isDestination ||
            gameSession.movableFountainIds.includes(fountain.fountainId) ||
            gameSession.fillableEntranceIds.includes(fountain.fountainId)}
        selected={isSource}
        destination={previewRoute?.to === fountain.fountainId}
        label={fountainLabel(fountain.fountainId, isSource, isDestination)}
        onselect={() => chooseFountain(fountain.fountainId)}
        onpreview={isDestination
            ? (previewing) => previewDestination(fountain.fountainId, previewing)
            : undefined}
    />
{/snippet}

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
        <filter id={SignShadowFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5"></feGaussianBlur>
        </filter>
        <AwningDefs />
        <CobbleDefs />
        <PawnDefs />
        <FountainDefs />
    </defs>
    <VisitorQueue />
    <g role="img" aria-label="MarraCash market" transform="translate({QueueMargin} {QueueMargin})">
        <rect width={BoardWidth} height={BoardHeight} rx="14" fill="#8a6a46"></rect>
        <rect
            x={WallThickness}
            y={WallThickness}
            width={BoardColumns * CellSize}
            height={BoardRows * CellSize}
            fill="url(#{CobblePatternId})"
        ></rect>

        {#each gates as gate (`${gate.x},${gate.y}`)}
            <rect
                x={gate.x}
                y={gate.y}
                width={gate.width}
                height={gate.height}
                fill="url(#{CobblePatternId})"
                stroke="#c99a2e"
                stroke-width="3"
            ></rect>
        {/each}

        {#each Palms as palm (`${palm.row},${palm.col}`)}
            <PalmTree center={cellCenter(palm)} />
        {/each}

        {#each groundShops as shop (shop.shopId)}
            <ShopTile {shop} selectable={gameSession.auctionableShopIds.includes(shop.shopId)} />
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
    </g>
</svg>

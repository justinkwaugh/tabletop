<script lang="ts">
    import { BoardColumns, BoardRows, Fountains, Palms } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShopTile from '$lib/components/ShopTile.svelte'
    import AwningDefs from '$lib/components/AwningDefs.svelte'
    import CobbleDefs from '$lib/components/CobbleDefs.svelte'
    import PawnDefs from '$lib/components/PawnDefs.svelte'
    import FountainSpot from '$lib/components/FountainSpot.svelte'
    import DirectionArrows from '$lib/components/DirectionArrows.svelte'
    import RoutePreview from '$lib/components/RoutePreview.svelte'
    import VisitorQueue from '$lib/components/VisitorQueue.svelte'
    import PalmTree from '$lib/components/PalmTree.svelte'
    import type { FountainId, Route } from '@tabletop/marracash'
    import {
        BoardHeight,
        BoardWidth,
        CellSize,
        cellCenter,
        gateRect,
        QueueMargin,
        ShopHaloFilterId,
        TableHeight,
        TableWidth,
        WallThickness
    } from '$lib/utils/boardGeometry.js'
    import { CobblePatternId } from '$lib/utils/cobbles.js'

    const gameSession = getGameSession()

    let spotlightShop = $derived(
        gameSession.gameState.shops.find(
            (shop) => shop.shopId === gameSession.gameState.auctionShopId
        )
    )
    let unspotlitShops = $derived(
        gameSession.gameState.shops.filter((shop) => shop !== spotlightShop)
    )

    let hoveredRoute: Route | undefined = $state()
    let previewRoute = $derived(
        !gameSession.updatingVisibleState &&
            hoveredRoute !== undefined &&
            hoveredRoute.from === gameSession.selectedFountainId
            ? hoveredRoute
            : undefined
    )

    function chooseFountain(fountainId: FountainId) {
        if (gameSession.fillableEntranceIds.includes(fountainId)) {
            void gameSession.bringVisitorsTo(fountainId)
        } else {
            gameSession.selectFountain(
                gameSession.selectedFountainId === fountainId ? undefined : fountainId
            )
        }
    }

    const gates = Fountains.filter((fountain) => fountain.entrance).map((fountain) =>
        gateRect(fountain.coords)
    )
</script>

<svg width={TableWidth} height={TableHeight} viewBox="0 0 {TableWidth} {TableHeight}">
    <defs>
        <filter id={ShopHaloFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="glow"></feGaussianBlur>
            <feMerge>
                <feMergeNode in="glow"></feMergeNode>
                <feMergeNode in="glow"></feMergeNode>
                <feMergeNode in="SourceGraphic"></feMergeNode>
            </feMerge>
        </filter>
        <AwningDefs />
        <CobbleDefs />
        <PawnDefs />
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

        {#each unspotlitShops as shop (shop.shopId)}
            <ShopTile {shop} selectable={gameSession.auctionableShopIds.includes(shop.shopId)} />
        {/each}

        {#each gameSession.gameState.fountains as fountain (fountain.fountainId)}
            <FountainSpot
                {fountain}
                selectable={gameSession.movableFountainIds.includes(fountain.fountainId) ||
                    gameSession.fillableEntranceIds.includes(fountain.fountainId)}
                selected={gameSession.selectedFountainId === fountain.fountainId}
                onselect={() => chooseFountain(fountain.fountainId)}
            />
        {/each}

        {#if previewRoute}
            <RoutePreview route={previewRoute} />
        {/if}

        <DirectionArrows
            routes={gameSession.selectedRoutes}
            onpreview={(route) => (hoveredRoute = route)}
            onchoose={(direction) => gameSession.moveVisitors(direction)}
        />

        {#if spotlightShop}
            <rect
                x={-QueueMargin}
                y={-QueueMargin}
                width={TableWidth}
                height={TableHeight}
                fill="#000000"
                opacity="0.5"
            ></rect>
            <ShopTile shop={spotlightShop} selectable={false} />
        {/if}
    </g>
</svg>

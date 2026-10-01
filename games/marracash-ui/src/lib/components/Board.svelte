<script lang="ts">
    import { BoardColumns, BoardRows, Fountains, Palms } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShopTile from '$lib/components/ShopTile.svelte'
    import FountainSpot from '$lib/components/FountainSpot.svelte'
    import DirectionArrows from '$lib/components/DirectionArrows.svelte'
    import RoutePreview from '$lib/components/RoutePreview.svelte'
    import type { FountainId, Route } from '@tabletop/marracash'
    import {
        BoardHeight,
        BoardWidth,
        CellSize,
        cellCenter,
        gateRect,
        WallThickness
    } from '$lib/utils/boardGeometry.js'

    const gameSession = getGameSession()

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

<svg
    width={BoardWidth}
    height={BoardHeight}
    viewBox="0 0 {BoardWidth} {BoardHeight}"
    role="img"
    aria-label="MarraCash market"
>
    <rect width={BoardWidth} height={BoardHeight} rx="14" fill="#8a6a46" />
    <rect
        x={WallThickness}
        y={WallThickness}
        width={BoardColumns * CellSize}
        height={BoardRows * CellSize}
        fill="#e8d7b5"
    />
    {#each { length: BoardRows + 1 } as _, row (row)}
        <line
            x1={WallThickness}
            x2={WallThickness + BoardColumns * CellSize}
            y1={WallThickness + row * CellSize}
            y2={WallThickness + row * CellSize}
            stroke="#d6c29b"
        />
    {/each}
    {#each { length: BoardColumns + 1 } as _, col (col)}
        <line
            y1={WallThickness}
            y2={WallThickness + BoardRows * CellSize}
            x1={WallThickness + col * CellSize}
            x2={WallThickness + col * CellSize}
            stroke="#d6c29b"
        />
    {/each}

    {#each gates as gate (`${gate.x},${gate.y}`)}
        <rect
            x={gate.x}
            y={gate.y}
            width={gate.width}
            height={gate.height}
            fill="#e8d7b5"
            stroke="#c99a2e"
            stroke-width="3"
        />
    {/each}

    {#each Palms as palm (`${palm.row},${palm.col}`)}
        {@const center = cellCenter(palm)}
        <circle cx={center.x} cy={center.y} r="30" fill="#3f8a4b" />
        <circle cx={center.x} cy={center.y} r="12" fill="#6fb25f" />
    {/each}

    {#each gameSession.gameState.shops as shop (shop.shopId)}
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
</svg>

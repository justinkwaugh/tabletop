<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { BOARD_GRID, RAILROAD_IDS } from '@tabletop/promontory-point'
    import { mapImage } from '$lib/images/boardImages.js'
    import {
        BORDER_TRACK_SPACES,
        MAP_SIZE,
        PRICE_TRACK_SPACES,
        SUPPLY_SLOTS,
        boxCentre,
        hexCentre,
        hexOutline
    } from '$lib/utils/boardGeometry.js'
    import '../../app.css'

    const map = mapImage()
    const hexes = [
        ...BOARD_GRID.spaces().map((space) => space.coords),
        ...BOARD_GRID.homeHexes().map((home) => home.coords)
    ]
    const priceSlots = PRICE_TRACK_SPACES.flatMap((space) =>
        RAILROAD_IDS.map((railroadId) => space.slots[railroadId])
    )
    const supply = [
        SUPPLY_SLOTS.bag,
        SUPPLY_SLOTS.endTracker,
        ...RAILROAD_IDS.map((railroadId) => SUPPLY_SLOTS.decks[railroadId])
    ]
    const points = (outline: Point[]) => outline.map(({ x, y }) => `${x},${y}`).join(' ')
</script>

<svelte:head><title>Promontory Point board geometry</title></svelte:head>

<div data-game-ui="promontory-point" class="min-h-screen bg-pp-table p-4">
    <svg
        viewBox="0 0 {MAP_SIZE.width} {MAP_SIZE.height}"
        class="block w-full h-auto"
        data-testid="geometry-overlay"
    >
        <image href={map.src} x="0" y="0" width={MAP_SIZE.width} height={MAP_SIZE.height}></image>
        {#each hexes as coords (`${coords.q},${coords.r}`)}
            {@const centre = hexCentre(coords)}
            <polygon points={points(hexOutline(coords))} class="frame hex"></polygon>
            <circle cx={centre.x} cy={centre.y} r="9" class="dot"></circle>
        {/each}
        {#each priceSlots as box, i (i)}
            {@const centre = boxCentre(box)}
            <rect x={box.x} y={box.y} width={box.width} height={box.height} class="frame track"
            ></rect>
            <circle cx={centre.x} cy={centre.y} r="7" class="dot"></circle>
        {/each}
        {#each BORDER_TRACK_SPACES as space (space.value)}
            {@const centre = boxCentre(space.box)}
            {#each space.sharingSlots as slot, i (i)}
                <rect
                    x={slot.x}
                    y={slot.y}
                    width={slot.width}
                    height={slot.height}
                    class="frame sharing"
                ></rect>
            {/each}
            <rect
                x={space.box.x}
                y={space.box.y}
                width={space.box.width}
                height={space.box.height}
                class="frame track"
            ></rect>
            <circle cx={centre.x} cy={centre.y} r="7" class="dot"></circle>
        {/each}
        {#each supply as box, i (i)}
            <rect x={box.x} y={box.y} width={box.width} height={box.height} class="frame supply"
            ></rect>
        {/each}
    </svg>
</div>

<style>
    .frame {
        fill: none;
        stroke-width: 4;
    }
    .hex {
        stroke: var(--pp-accent);
    }
    .track {
        stroke: var(--pp-cost);
    }
    .sharing {
        stroke: var(--pp-decided);
        stroke-width: 2;
        stroke-dasharray: 6 6;
    }
    .supply {
        stroke: var(--pp-ok);
        stroke-width: 6;
    }
    .dot {
        fill: var(--pp-cost);
        stroke: var(--pp-halo);
        stroke-width: 3;
    }
</style>

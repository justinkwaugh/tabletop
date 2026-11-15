<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { supplyKey } from '$lib/animators/flights.svelte.js'
    import { cubeSquare } from '$lib/utils/cubeShape.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import {
        PILE_CUBE,
        PILE_GHOST,
        pileCubes,
        pileFootprint,
        type PileFit
    } from '$lib/utils/supplyPile.js'

    let {
        railroadId,
        supply,
        fit,
        unit
    }: {
        railroadId: RailroadId
        supply: number
        fit: PileFit
        /** Screen pixels a pile unit. */
        unit: number
    } = $props()

    // An empty supply draws its ghost column alone, wherever the pile is drawn.
    const footprint = $derived(pileFootprint(supply > 0 ? fit : 'follow', supply))
    const fill = $derived(railroadStyle(railroadId).fill)
    const squares = $derived(
        pileCubes(supply).map((cube) => cubeSquare(cube.x, cube.y, PILE_CUBE.side))
    )
</script>

<!-- Art plan, Supply pile: the locomotives left (R-1.1), drawn as the cubes themselves with no
     number, or a dashed ghost column once none is left; what a share or placement flight lifts
     from. -->
<svg
    class="block shrink-0"
    width={footprint.width * unit}
    height={footprint.height * unit}
    viewBox="0 0 {footprint.width} {footprint.height}"
    aria-hidden="true"
    data-supply-pile={railroadId}
    data-flight-target={supplyKey(railroadId)}
>
    {#if supply === 0}
        <rect
            x={PILE_GHOST.x}
            y={PILE_GHOST.y}
            width={PILE_GHOST.width}
            height={PILE_GHOST.height}
            rx="1.5"
            fill="none"
            stroke={fill}
            stroke-opacity={PILE_GHOST.opacity}
            stroke-width={PILE_GHOST.stroke}
            stroke-dasharray={PILE_GHOST.dash}
            data-supply-ghost
        ></rect>
    {/if}
    {#each squares as square, index (index)}
        <rect
            x={square.x}
            y={square.y}
            width={square.width}
            height={square.height}
            rx={square.rx}
            {fill}
            stroke="var(--rtr-cube-edge)"
            stroke-width={PILE_CUBE.edge}
        ></rect>
    {/each}
</svg>

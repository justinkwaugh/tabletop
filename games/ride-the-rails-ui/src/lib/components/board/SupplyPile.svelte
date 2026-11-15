<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { supplyKey } from '$lib/animators/flights.svelte.js'
    import { cubeSquare } from '$lib/utils/cubeShape.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import {
        PILE_CUBE,
        PILE_PIXELS_PER_UNIT,
        pileCubes,
        pileFootprint,
        type PileArrangement
    } from '$lib/utils/supplyPile.js'

    let {
        railroadId,
        supply,
        arrangement
    }: { railroadId: RailroadId; supply: number; arrangement: PileArrangement } = $props()

    const footprint = $derived(pileFootprint(arrangement))
    const scale = $derived(PILE_PIXELS_PER_UNIT[arrangement])
    const fill = $derived(railroadStyle(railroadId).fill)
    const squares = $derived(
        pileCubes(supply, arrangement).map((cube) => cubeSquare(cube.x, cube.y, PILE_CUBE.side))
    )
</script>

<!-- Art plan, Supply pile: the locomotives left (R-1.1-H1), drawn as the cubes themselves with no
     number; what a share or placement flight lifts from. -->
<svg
    class="block shrink-0"
    width={footprint.width * scale}
    height={footprint.height * scale}
    viewBox="0 0 {footprint.width} {footprint.height}"
    aria-hidden="true"
    data-supply-pile={railroadId}
    data-flight-target={supplyKey(railroadId)}
>
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

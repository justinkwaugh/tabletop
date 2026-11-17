<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { IMPASSABLE_LINE, impassablePath } from '$lib/utils/terrainMarks.js'

    const gameSession = getGameSession()

    // Displayed Game State: the shown state's map. R-8.3, R-8.4: each impassable side as a red
    // line on a pale casing, one path for each, over the cities' bands, the cubes and the scrim.
    const SIDES = $derived(impassablePath(gameSession.boardFrame))
</script>

<!-- Contract, Render ownership: over the bands, cubes, lines and scrim; under the passengers (a
     head reaching across a side stands over its line), the staged route, picks, flights and hit
     targets. It takes no presses. -->
{#if SIDES}
    <g
        class="impassable"
        aria-hidden="true"
        pointer-events="none"
        fill="none"
        stroke-linecap="round"
        data-impassable-sides
    >
        <path
            d={SIDES}
            stroke="var(--rtr-plain)"
            stroke-width={IMPASSABLE_LINE.width + 2 * IMPASSABLE_LINE.casing}
        ></path>
        <path d={SIDES} stroke="var(--rtr-impassable)" stroke-width={IMPASSABLE_LINE.width}></path>
    </g>
{/if}

<script lang="ts">
    import { BATTLEFIELD_EVEN_ODD_PATH } from '$lib/map/battlefield.js'
    import { PRINTED_BARS } from '$lib/map/boardGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BAR_HALF_THICKNESS } from '$lib/utils/pieceLayout.js'

    const gameSession = getGameSession()
</script>

{#if gameSession.darkBorders}
    <clipPath id="nt-battlefield">
        <path d={BATTLEFIELD_EVEN_ODD_PATH} clip-rule="evenodd"></path>
    </clipPath>
    <g class="pointer-events-none" fill="#2b2620" opacity="0.15" clip-path="url(#nt-battlefield)">
        {#each PRINTED_BARS as bar (`${bar.centre.x}:${bar.centre.y}`)}
            <rect
                transform="translate({bar.centre.x} {bar.centre.y}) rotate({bar.angle})"
                x={-bar.length / 2}
                y={-BAR_HALF_THICKNESS}
                width={bar.length}
                height={BAR_HALF_THICKNESS * 2}
            ></rect>
        {/each}
    </g>
{/if}

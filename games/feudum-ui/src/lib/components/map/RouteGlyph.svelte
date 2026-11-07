<script lang="ts">
    import { FerryFare, type RouteMedium } from '@tabletop/feudum'
    import { VesselPaths } from '$lib/utils/pieceShapes.js'

    /** A route's medium as a glyph at its middle, so none is told by colour alone. */
    let { medium, x, y }: { medium: RouteMedium; x: number; y: number } = $props()

    const FerryHull = 'M4 18 L44 18 L36 28 L12 28 Z M22 6 L26 6 L26 18 L22 18 Z'
</script>

{#if medium !== 'road'}
    <g transform="translate({x - 14} {y - 10}) scale(0.58)" data-glyph={medium}>
        <circle
            cx="24"
            cy="17"
            r="25"
            fill="var(--feudum-parchment)"
            stroke="var(--feudum-route-{medium === 'flying-machine' ? 'flying' : medium})"
            stroke-width="3"
        ></circle>
        {#if medium === 'ferry'}
            <path d={FerryHull} fill="var(--feudum-ink)"></path>
        {:else}
            <path d={VesselPaths[medium].hull} fill="var(--feudum-ink)"></path>
            <path d={VesselPaths[medium].part} fill="var(--feudum-ink)"></path>
        {/if}
    </g>
    {#if medium === 'ferry'}
        <text
            x={x + 22}
            y={y + 6}
            font-size="15"
            font-weight="700"
            fill="var(--feudum-map-ink)"
            data-fare>{FerryFare}s</text
        >
    {/if}
{/if}

<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import {
        BAND_SEPARATOR_WIDTH,
        startBand,
        startBandPaths,
        startBandSeparators,
        startBandSpans
    } from '$lib/utils/cityMarks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { startColours }: { startColours: readonly RailroadId[] } = $props()

    const band = $derived(startBand(startColours))
    const spans = $derived(startBandSpans(band.railroadIds.length))
    const paths = $derived(startBandPaths(spans, band.width))
    const separators = $derived(startBandSeparators(spans, band.width))
</script>

<!-- Art plan, Start band (BOARD_LOOK.startMark 'band'): the colours that may start here, just
     inside the hex's edge, in equal parts clockwise from the top corner; a plain city's is Black.
     Centred on the hex's centre. -->
<g aria-hidden="true" data-start-band={band.railroadIds.length}>
    {#each paths as path, index (index)}
        {@const railroadId = band.railroadIds[index]}
        {#if railroadId}
            <path
                d={path}
                fill={railroadStyle(railroadId).fill}
                fill-rule="evenodd"
                data-band-colour={railroadId}
            ></path>
        {/if}
    {/each}
    {#each separators as separator, index (index)}
        <path d={separator} stroke="var(--rtr-patch-edge)" stroke-width={BAND_SEPARATOR_WIDTH}
        ></path>
    {/each}
</g>

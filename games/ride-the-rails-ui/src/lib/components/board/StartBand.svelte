<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import {
        BAND_SEPARATOR_WIDTH,
        startBand,
        startBandPaths,
        startBandSeparators,
        startBandSpans
    } from '$lib/utils/cityMarks.js'
    import type { HexFrame } from '$lib/utils/hexFrame.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import { outlineBandPaths, outlineBandSeparators } from '$lib/utils/terrainMarks.js'

    let {
        startColours,
        frame,
        outline
    }: {
        startColours: readonly RailroadId[]
        frame: HexFrame
        /** R-8.5: the outline of a city over two cells (Berlin), from its centre. */
        outline?: readonly Point[]
    } = $props()

    const band = $derived(startBand(startColours))
    const spans = $derived(startBandSpans(band.railroadIds.length))
    const paths = $derived(
        outline
            ? outlineBandPaths(outline, spans, band.width)
            : startBandPaths(spans, band.width, frame)
    )
    const separators = $derived(
        outline
            ? outlineBandSeparators(outline, spans, band.width)
            : startBandSeparators(spans, band.width, frame)
    )
</script>

<!-- Art plan, Start band (BOARD_LOOK.startMark 'band'): the colours that may start here, just
     inside the hex's edge, in equal parts clockwise from the top (a pointy hex's top corner, the
     middle of a flat hex's top edge); a plain city's is Black. Centred on the hex's centre; a city
     over two cells (Berlin) has one band round its whole outline. -->
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

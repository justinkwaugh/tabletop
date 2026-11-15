<script lang="ts">
    import { USA_CITIES } from '@tabletop/ride-the-rails'
    import {
        cityLabel,
        cityLabelFontSize,
        drawsCityLabels,
        mapLabelName
    } from '$lib/utils/boardGeometry.js'

    let { viewScale }: { viewScale: number } = $props()

    const fontSize = $derived(cityLabelFontSize(viewScale))
    const labelled = $derived(drawsCityLabels(viewScale))

    // A name's halo, in the plain's colour, as a share of its size.
    const LABEL_HALO = 0.3
</script>

<!-- Contract, Render ownership: every city's name, lit or not, above the cubes, route lines and
     picks, so neither a cube nor a ring, ghost cube or mark in a neighbouring hex covers a name.
     A press passes through a name to the hex beneath. -->
<g class="city-labels" aria-hidden="true" pointer-events="none">
    {#if labelled}
        {#each USA_CITIES as city (city.id)}
            {@const label = cityLabel(city.id, fontSize)}
            <text
                class="rtr-serif"
                x={label.x}
                y={label.y}
                font-size={label.fontSize}
                text-anchor={label.textAnchor}
                fill="var(--rtr-ink)"
                stroke="var(--rtr-plain)"
                stroke-width={label.fontSize * LABEL_HALO}
                stroke-linejoin="round"
                paint-order="stroke">{mapLabelName(city.id)}</text
            >
        {/each}
    {/if}
</g>

<script lang="ts">
    import { USA_CITIES, type HexId } from '@tabletop/ride-the-rails'
    import {
        cityLabel,
        cityLabelFontSize,
        drawsCityLabels,
        mapLabelName
    } from '$lib/utils/boardGeometry.js'

    let { viewScale, litHexIds }: { viewScale: number; litHexIds: ReadonlySet<HexId> } = $props()

    const fontSize = $derived(cityLabelFontSize(viewScale))
    const labelled = $derived(drawsCityLabels(viewScale))

    // A name's halo, in the plain's colour, as a share of its size.
    const LABEL_HALO = 0.3
</script>

<!-- Contract, Render ownership: the city names, above the cubes and route lines, so a cube in a
     neighbouring hex never covers a name; a lit city's name gives way to its pick marks. -->
<g class="city-labels" aria-hidden="true">
    {#if labelled}
        {#each USA_CITIES as city (city.id)}
            {#if !litHexIds.has(city.hexId)}
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
            {/if}
        {/each}
    {/if}
</g>

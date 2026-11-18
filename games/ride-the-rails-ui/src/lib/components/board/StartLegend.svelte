<script lang="ts">
    import type { MapId } from '@tabletop/ride-the-rails'
    import {
        legendBox,
        legendCubeX,
        legendRows,
        legendTextX,
        START_LEGEND
    } from '$lib/utils/mapLayouts.js'
    import RailroadPiece from './RailroadPiece.svelte'

    let { mapId }: { mapId: MapId } = $props()

    // In board units, standing on the corner the map's layout gives, in its open sea.
    const {
        pad: PAD,
        titleSize: TITLE_SIZE,
        textSize: TEXT_SIZE,
        row: ROW,
        cube: CUBE
    } = START_LEGEND
    // R-4.2.1 to R-4.2.5, R-8: one row per start rule of the map, in its own words, the text past
    // the widest row's cubes.
    const ROWS = $derived(legendRows(mapId))
    const TEXT_X = $derived(legendTextX(mapId))
    const box = $derived(legendBox(mapId))
</script>

<!-- R-4.2: a legend in the sea of where each railroad starts, a cube in its colour per rule; the
     city bands on the board show the same colours. -->
<g class="start-legend" aria-hidden="true" transform="translate({box.x} {box.y})" data-start-legend>
    <rect
        width={box.width}
        height={box.height}
        rx="8"
        fill="var(--rtr-panel)"
        stroke="var(--rtr-card-edge)"
        stroke-width="1.5"
    ></rect>
    <text
        x={PAD}
        y={PAD + TITLE_SIZE * 0.8}
        font-size={TITLE_SIZE}
        font-weight="700"
        fill="var(--rtr-ink)">First locomotive</text
    >
    {#each ROWS as row, index (row.text)}
        {@const y = PAD + TITLE_SIZE + 10 + index * ROW + ROW / 2}
        {#each row.railroadIds as railroadId, cube (railroadId)}
            <RailroadPiece {railroadId} x={legendCubeX(cube)} {y} width={CUBE} />
        {/each}
        <text x={TEXT_X} y={y + TEXT_SIZE * 0.35} font-size={TEXT_SIZE} fill="var(--rtr-ink)"
            >{row.text}</text
        >
    {/each}
</g>

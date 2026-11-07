<script lang="ts">
    import { RegionIds, RegionTileChart, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import CountChip from '$lib/components/map/CountChip.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import { stackView } from '$lib/model/boardView.js'
    import {
        DieCentre,
        DieSize,
        StackCentres,
        StackCountOffset,
        StackSize,
        TileChart,
        TileChartRows,
        trackPlace
    } from '$lib/utils/boardGeometry.js'

    /**
     * R-4.3.1 Six stacks, the top tile showing its epoch; the print's V shows under an empty one.
     * R-4.11.1 The progress die stands beside them. `printed` false draws our own stack spaces, V and
     * R-4.3.2 chart; the print holds those itself, so they are not drawn a second time over it.
     */
    let { state, printed }: { state: HydratedFeudumGameState; printed: boolean } = $props()

    const ChartColumns = ['farm', 'town', 'feudum'] as const
    const ChartHeads = { farm: 'Fm', town: 'Tn', feudum: 'Fd' } as const
    const Numerals = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' } as const
</script>

{#if !printed}
    <g data-drawn-chart style:font-family="var(--feudum-font-text)">
        <rect
            x={TileChart.x}
            y={TileChart.y}
            width={TileChart.width}
            height={TileChart.height}
            rx="4"
            fill="var(--feudum-parchment)"
            stroke="var(--feudum-map-ink)"
        ></rect>
        {#each ChartColumns as column, index (column)}
            <text
                x={TileChart.columns[index + 1]}
                y={TileChart.headerY}
                text-anchor="middle"
                font-size="11"
                fill="var(--feudum-ink)">{ChartHeads[column]}</text
            >
        {/each}
        {#each RegionTileChart as row (row.id)}
            {@const at = trackPlace(TileChartRows, row.id)}
            <g data-chart-row={row.tileEpoch}>
                <text
                    x={at.x}
                    y={at.y + 4}
                    text-anchor="middle"
                    font-size="12"
                    fill="var(--feudum-ink)">{Numerals[row.tileEpoch]}</text
                >
                {#if row.vp}
                    {#each ChartColumns as column, index (column)}
                        <text
                            x={TileChart.columns[index + 1]}
                            y={at.y + 4}
                            text-anchor="middle"
                            font-size="12"
                            fill="var(--feudum-ink)">{row.vp[column]}</text
                        >
                    {/each}
                {:else}
                    <line
                        x1={TileChart.columns[1] - 8}
                        y1={at.y}
                        x2={TileChart.columns[3] + 6}
                        y2={at.y}
                        stroke="var(--feudum-ink)"
                        stroke-width="1.5"
                    ></line>
                {/if}
            </g>
        {/each}
    </g>
{/if}

{#each RegionIds as region (region)}
    {@const stack = stackView(state, region)}
    {@const centre = StackCentres[region]}
    <g data-stack={region} data-count={stack.count}>
        {#if !printed}
            <rect
                x={centre.x - StackSize / 2}
                y={centre.y - StackSize / 2}
                width={StackSize}
                height={StackSize}
                fill="var(--feudum-parchment-shade)"
                stroke="var(--feudum-map-ink)"
            ></rect>
            {#if stack.topEpoch === undefined}
                <text
                    x={centre.x}
                    y={centre.y + 10}
                    text-anchor="middle"
                    font-size="28"
                    fill="var(--feudum-ink)"
                    style:font-family="var(--feudum-font-title)"
                    data-printed-v>V</text
                >
            {/if}
        {/if}
        {#if stack.topEpoch !== undefined}
            <BoardPiece at={centre} piece="stack:{region}">
                <TileFace
                    faceShown={false}
                    epoch={stack.topEpoch}
                    {region}
                    size={StackSize}
                    x={-StackSize / 2}
                    y={-StackSize / 2}
                />
                <CountChip count={stack.count} x={StackCountOffset.x} y={StackCountOffset.y} />
            </BoardPiece>
        {/if}
    </g>
{/each}

<BoardPiece at={DieCentre} piece="progress-die">
    <g role="img" aria-label="progress die" data-die>
        <title>Progress die</title>
        <rect
            x={-DieSize / 2}
            y={-DieSize / 2}
            width={DieSize}
            height={DieSize}
            rx="7"
            fill="var(--feudum-wood-piece)"
            stroke="var(--feudum-wood-dark)"
            stroke-width="2"
        ></rect>
        <text
            y="6"
            text-anchor="middle"
            font-size="11"
            fill="var(--feudum-ink)"
            style:font-family="var(--feudum-font-text)">die</text
        >
    </g>
</BoardPiece>

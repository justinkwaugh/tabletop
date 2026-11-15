<script lang="ts">
    import { siteChart, type SiteChartSeries } from '$lib/utils/siteStatsChart'
    import ChartDataTable from '$lib/components/stats/ChartDataTable.svelte'
    import ChartHoverSlots from '$lib/components/stats/ChartHoverSlots.svelte'
    import ChartKey from '$lib/components/stats/ChartKey.svelte'
    import ChartTooltip from '$lib/components/stats/ChartTooltip.svelte'

    let {
        caption,
        labels,
        series,
        height = 200
    }: { caption: string; labels: string[]; series: SiteChartSeries[]; height?: number } = $props()

    let width = $state(0)
    let hoveredIndex = $state<number>()
    const tones = $derived(new Map(series.map((entry) => [entry.key, entry.tone])))
    const chart = $derived(
        width > 0
            ? siteChart({
                  labels,
                  columns: series.filter((entry) => entry.kind === 'column'),
                  lines: series.filter((entry) => entry.kind === 'line'),
                  width,
                  height
              })
            : undefined
    )
    const hovered = $derived(hoveredIndex === undefined ? undefined : chart?.slots[hoveredIndex])

    function formatValue(value: number | undefined) {
        return value === undefined ? 'not rolled up' : value.toLocaleString()
    }

    function toneColor(entry: SiteChartSeries) {
        return `var(--tone-${entry.tone})`
    }
</script>

<div class="site-chart">
    <div class="chart" bind:clientWidth={width}>
        {#if chart}
            <svg
                viewBox={`0 0 ${width} ${height}`}
                {height}
                aria-hidden="true"
                onpointerleave={() => (hoveredIndex = undefined)}
            >
                {#each chart.gridlines as line (line.value)}
                    <line
                        class="grid"
                        class:baseline={line.value === 0}
                        x1={chart.plotLeft}
                        x2={width}
                        y1={line.y}
                        y2={line.y}
                    ></line>
                    <text x={chart.plotLeft - 8} y={line.y + 4} text-anchor="end">{line.label}</text
                    >
                {/each}
                {#each chart.slots as slot, index (index)}
                    {#each slot.columns as column (column.key)}
                        <path class="column {tones.get(column.key)}" d={column.path}></path>
                    {/each}
                    {#if slot.label}
                        <text x={slot.centerX} y={height - 4} text-anchor="middle"
                            >{slot.label}</text
                        >
                    {/if}
                {/each}
                {#each chart.lines as line (line.key)}
                    <path class="line {tones.get(line.key)}" d={line.path}></path>
                {/each}
                {#if hovered}
                    <line
                        class="cursor"
                        x1={hovered.centerX}
                        x2={hovered.centerX}
                        y1="0"
                        y2={chart.plotBottom}
                    ></line>
                {/if}
                <ChartHoverSlots
                    slotXs={chart.slots.map((slot) => slot.slotX)}
                    width={chart.slotWidth}
                    height={chart.plotBottom}
                    onhover={(index) => (hoveredIndex = index)}
                />
            </svg>
            {#if hovered && hoveredIndex !== undefined}
                {@const index = hoveredIndex}
                <ChartTooltip
                    x={hovered.centerX}
                    y={hovered.topY}
                    trailing={hovered.centerX > width / 2}
                >
                    <div class="tooltip-title">{labels[index]}</div>
                    {#each series as entry (entry.key)}
                        <div>
                            <span class="swatch" style:background={toneColor(entry)}
                            ></span>{entry.name}:
                            {formatValue(entry.values[index])}
                        </div>
                    {/each}
                </ChartTooltip>
            {/if}
        {/if}
    </div>
    {#if series.length > 1}
        <ChartKey
            entries={series.map((entry) => ({
                label: entry.name,
                color: toneColor(entry),
                thin: entry.kind === 'line'
            }))}
        />
    {/if}
    <ChartDataTable
        {caption}
        headers={['Period', ...series.map((entry) => entry.name)]}
        rows={labels.map((label, index) => [
            label,
            ...series.map((entry) => formatValue(entry.values[index]))
        ])}
    />
</div>

<style>
    .site-chart {
        --tone-blue: #3b8eff;
        --tone-orange: #e8743b;
        --tone-green: #2fb380;
    }
    .chart {
        position: relative;
    }
    svg {
        display: block;
        width: 100%;
        overflow: visible;
    }
    line.grid {
        stroke: rgb(54 65 83 / 0.7);
    }
    line.baseline {
        stroke: var(--color-gray-600);
    }
    line.cursor {
        stroke: var(--color-gray-500);
    }
    text {
        fill: var(--color-gray-400);
        font-size: 11px;
    }
    path.column.blue {
        fill: var(--tone-blue);
    }
    path.column.orange {
        fill: var(--tone-orange);
    }
    path.column.green {
        fill: var(--tone-green);
    }
    path.line {
        fill: none;
        stroke-width: 2;
        stroke-linejoin: round;
    }
    path.line.blue {
        stroke: var(--tone-blue);
    }
    path.line.orange {
        stroke: var(--tone-orange);
    }
    path.line.green {
        stroke: var(--tone-green);
    }
    .tooltip-title {
        font-weight: 600;
    }
    .swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        margin-right: 6px;
    }
</style>

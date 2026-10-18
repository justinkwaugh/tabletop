<script lang="ts">
    import { siteChart, type SiteChartSeries } from '$lib/utils/siteStatsChart'

    let {
        caption,
        labels,
        series,
        height = 200
    }: { caption: string; labels: string[]; series: SiteChartSeries[]; height?: number } =
        $props()

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
                <text x={chart.plotLeft - 8} y={line.y + 4} text-anchor="end">{line.label}</text>
            {/each}
            {#each chart.slots as slot, index (index)}
                {#each slot.columns as column (column.key)}
                    <path class="column {tones.get(column.key)}" d={column.path}></path>
                {/each}
                {#if slot.label}
                    <text x={slot.centerX} y={height - 4} text-anchor="middle">{slot.label}</text>
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
            {#each chart.slots as slot, index (index)}
                <rect
                    class="slot"
                    role="presentation"
                    x={slot.slotX}
                    y="0"
                    width={chart.slotWidth}
                    height={chart.plotBottom}
                    onpointerenter={() => (hoveredIndex = index)}
                ></rect>
            {/each}
        </svg>
        {#if hovered && hoveredIndex !== undefined}
            <div
                class="tooltip"
                class:trailing={hovered.centerX > width / 2}
                style:left={`${hovered.centerX}px`}
                style:top={`${hovered.topY - 6}px`}
            >
                <div class="tooltip-title">{labels[hoveredIndex]}</div>
                {#each series as entry (entry.key)}
                    <div>
                        <span class="swatch {entry.tone}"></span>{entry.name}: {formatValue(
                            entry.values[hoveredIndex]
                        )}
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>
{#if series.length > 1}
    <ul class="key" aria-hidden="true">
        {#each series as entry (entry.key)}
            <li><span class="swatch {entry.tone}" class:thin={entry.kind === 'line'}></span>{entry.name}</li>
        {/each}
    </ul>
{/if}
<table class="sr-only">
    <caption>{caption}</caption>
    <thead>
        <tr>
            <th>Period</th>
            {#each series as entry (entry.key)}<th>{entry.name}</th>{/each}
        </tr>
    </thead>
    <tbody>
        {#each labels as label, index (index)}
            <tr>
                <td>{label}</td>
                {#each series as entry (entry.key)}<td>{formatValue(entry.values[index])}</td>{/each}
            </tr>
        {/each}
    </tbody>
</table>
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
    .slot {
        fill: transparent;
    }
    .tooltip {
        position: absolute;
        z-index: 1;
        pointer-events: none;
        transform: translate(-12px, -100%);
        background: var(--color-gray-100);
        color: var(--color-gray-900);
        border-radius: 6px;
        padding: 6px 9px;
        font-size: 12px;
        white-space: nowrap;
    }
    .tooltip.trailing {
        transform: translate(calc(-100% + 12px), -100%);
    }
    .tooltip-title {
        font-weight: 600;
    }
    .key {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin-top: 10px;
        color: var(--color-gray-400);
        font-size: 12px;
    }
    .swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        margin-right: 6px;
    }
    .swatch.thin {
        height: 3px;
        vertical-align: middle;
    }
    .swatch.blue {
        background: var(--tone-blue);
    }
    .swatch.orange {
        background: var(--tone-orange);
    }
    .swatch.green {
        background: var(--tone-green);
    }
</style>

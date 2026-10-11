<script lang="ts">
    import { countOf, monthName, type CalendarMonth, type MonthlyPlays } from '$lib/utils/gameStats'
    import { monthlyChart } from '$lib/utils/monthlyChart'

    let { monthlyPlays, months }: { monthlyPlays: MonthlyPlays[]; months: CalendarMonth[] } =
        $props()

    const HEIGHT = 200
    let width = $state(0)
    let hoveredMonth = $state<string>()
    const chart = $derived(
        width > 0 ? monthlyChart(monthlyPlays, months, width, HEIGHT) : undefined
    )
    const hovered = $derived(chart?.columns.find((column) => column.month === hoveredMonth))
</script>

<div class="chart" bind:clientWidth={width}>
    {#if chart}
        <svg
            viewBox={`0 0 ${width} ${HEIGHT}`}
            height={HEIGHT}
            aria-hidden="true"
            onpointerleave={() => (hoveredMonth = undefined)}
        >
            {#each chart.gridlines as line (line.value)}
                <line
                    class:baseline={line.value === 0}
                    x1={chart.plotLeft}
                    x2={width}
                    y1={line.y}
                    y2={line.y}
                ></line>
                <text x={chart.plotLeft - 8} y={line.y + 4} text-anchor="end">{line.value}</text>
            {/each}
            {#each chart.columns as column (column.month)}
                {#if column.wonOrTiedPath}<path class="won-or-tied" d={column.wonOrTiedPath}
                    ></path>{/if}
                {#if column.lostPath}<path class="lost" d={column.lostPath}></path>{/if}
                {#if column.label}
                    <text x={column.centerX} y={HEIGHT - 4} text-anchor="middle">
                        {column.label}
                    </text>
                {/if}
                <rect
                    class="slot"
                    role="presentation"
                    x={column.slotX}
                    y="0"
                    width={chart.slotWidth}
                    height={chart.plotBottom}
                    onpointerenter={() => (hoveredMonth = column.month)}
                ></rect>
            {/each}
        </svg>
        {#if hovered}
            <div
                class="tooltip"
                class:trailing={hovered.centerX > width / 2}
                style:left={`${hovered.centerX}px`}
                style:top={`${hovered.topY - 6}px`}
            >
                {monthName(hovered.month, 'long')}: {hovered.plays} finished, {hovered.wonOrTied} won
                or tied
            </div>
        {/if}
    {/if}
</div>
<ul class="key" aria-hidden="true">
    <li><span class="swatch won-or-tied"></span>Won or tied</li>
    <li><span class="swatch lost"></span>Lost</li>
</ul>
<table class="sr-only">
    <caption>Games finished per month</caption>
    <thead>
        <tr><th>Month</th><th>Finished</th><th>Won or tied</th></tr>
    </thead>
    <tbody>
        {#each monthlyPlays as entry (entry.month)}
            <tr>
                <td>{monthName(entry.month, 'long')}</td>
                <td>{countOf(entry.plays, 'game')}</td>
                <td>{entry.wonOrTied}</td>
            </tr>
        {/each}
    </tbody>
</table>

<style>
    .chart {
        position: relative;
    }
    svg {
        display: block;
        width: 100%;
        overflow: visible;
    }
    line {
        stroke: rgb(54 65 83 / 0.7);
    }
    line.baseline {
        stroke: var(--color-gray-600);
    }
    text {
        fill: var(--color-gray-400);
        font-size: 11px;
    }
    path.won-or-tied {
        fill: var(--stats-mark);
    }
    path.lost {
        fill: var(--color-gray-600);
    }
    .slot {
        fill: transparent;
    }
    .tooltip {
        position: absolute;
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
    .key {
        display: flex;
        gap: 18px;
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
    .swatch.won-or-tied {
        background: var(--stats-mark);
    }
    .swatch.lost {
        background: var(--color-gray-600);
    }
</style>

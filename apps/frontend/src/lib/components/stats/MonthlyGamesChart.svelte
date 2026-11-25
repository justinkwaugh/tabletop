<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import { monthName, type MonthIndex, type MonthlyGames } from '$lib/utils/gameStats'
    import { monthlyChart } from '$lib/utils/monthlyChart'
    import ChartDataTable from './ChartDataTable.svelte'
    import ChartHoverSlots from './ChartHoverSlots.svelte'
    import ChartKey from './ChartKey.svelte'
    import ChartTooltip from './ChartTooltip.svelte'

    let { monthlyGames, months }: { monthlyGames: MonthlyGames[]; months: MonthIndex[] } = $props()

    const HEIGHT = 200
    let width = $state(0)
    let hoveredMonth = $state<MonthIndex>()
    const chart = $derived(
        width > 0 ? monthlyChart(monthlyGames, months, width, HEIGHT) : undefined
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
            {/each}
            <ChartHoverSlots
                slotXs={chart.columns.map((column) => column.slotX)}
                width={chart.slotWidth}
                height={chart.plotBottom}
                onhover={(index) => (hoveredMonth = chart.columns[index].month)}
            />
        </svg>
        {#if hovered}
            <ChartTooltip
                x={hovered.centerX}
                y={hovered.topY}
                trailing={hovered.centerX > width / 2}
            >
                {m.content_stats_month_tooltip({
                    month: monthName(hovered.month, 'long'),
                    games: hovered.games,
                    wonOrTied: hovered.wonOrTied
                })}
            </ChartTooltip>
        {/if}
    {/if}
</div>
<ChartKey
    entries={[
        { label: m.content_stats_won_or_tied(), color: 'var(--stats-mark)' },
        { label: m.content_stats_lost(), color: 'var(--color-gray-600)' }
    ]}
/>
<ChartDataTable
    caption={m.content_stats_games_per_month()}
    headers={[m.content_stats_month(), m.content_stats_finished(), m.content_stats_won_or_tied()]}
    rows={monthlyGames.map((entry) => [
        monthName(entry.month, 'long'),
        m.played_game_count({ count: entry.games }),
        String(entry.wonOrTied)
    ])}
/>

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
</style>

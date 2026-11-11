<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import type { WealthPoint } from './wealthHistory.js'
    import { nearestRound, spreadLabels, wealthChart } from './wealthChart.js'

    let {
        money,
        points,
        players
    }: {
        money: MoneyFormat
        points: readonly WealthPoint[]
        players: readonly { playerId: string; name: string; color: string }[]
    } = $props()

    const END_LABEL_GAP = 4
    const END_LABEL_SPACING = 14
    // Approximate character widths of the 12px player names and the 11px axis values.
    const NAME_CHARACTER_WIDTH = 7
    const VALUE_CHARACTER_WIDTH = 6.5
    let width = $state(0)
    let height = $state(0)
    let hovered = $state<number>()
    const endLabelWidth = $derived(
        3 * END_LABEL_GAP +
            NAME_CHARACTER_WIDTH * Math.max(...players.map((player) => player.name.length))
    )
    const chart = $derived(
        width > 0 && height > 0
            ? wealthChart({
                  points,
                  playerIds: players.map((player) => player.playerId),
                  width: width - endLabelWidth,
                  height,
                  valueLabelWidth: (value) => VALUE_CHARACTER_WIDTH * money(value).length
              })
            : undefined
    )
    const colors = $derived(new Map(players.map((player) => [player.playerId, player.color])))
    const endLabels = $derived.by(() => {
        if (!chart) return []
        const latest = points.at(-1)
        const ys = spreadLabels(
            players.map((player) => chart.y(latest?.wealth[player.playerId] ?? 0)),
            END_LABEL_SPACING,
            chart.plotBottom
        )
        return players.map((player, index) => ({ ...player, y: ys[index] }))
    })
    const hoveredPoint = $derived(hovered === undefined ? undefined : points[hovered])
    const ranked = $derived(
        hoveredPoint
            ? players.toSorted(
                  (a, b) =>
                      (hoveredPoint.wealth[b.playerId] ?? 0) -
                      (hoveredPoint.wealth[a.playerId] ?? 0)
              )
            : []
    )

    function hover(event: PointerEvent & { currentTarget: SVGSVGElement }) {
        if (!chart) return
        const bounds = event.currentTarget.getBoundingClientRect()
        hovered = nearestRound(chart, points.length, event.clientX - bounds.left)
    }
</script>

<figure class="wealth-chart">
    <figcaption>Wealth at the start and after each round</figcaption>
    <div class="plot" bind:clientWidth={width} bind:clientHeight={height}>
        {#if chart}
            <svg
                viewBox={`0 0 ${width} ${height}`}
                {width}
                {height}
                aria-hidden="true"
                onpointermove={hover}
                onpointerdown={hover}
                onpointerleave={() => (hovered = undefined)}
            >
                {#each chart.gridlines as line (line.value)}
                    <line
                        class="grid"
                        class:baseline={line.value === 0}
                        x1={chart.plotLeft}
                        x2={chart.plotRight}
                        y1={line.y}
                        y2={line.y}
                    ></line>
                    <text
                        class="value-label"
                        x={chart.plotLeft - 8}
                        y={line.y + 4}
                        text-anchor="end">{money(line.value)}</text
                    >
                {/each}
                {#each chart.roundLabels as label (label.index)}
                    <text
                        class="round-label"
                        x={label.x}
                        y={chart.plotBottom + 16}
                        text-anchor={label.index === 0 ? 'start' : 'middle'}>{label.label}</text
                    >
                {/each}
                {#if hovered !== undefined}
                    <line
                        class="crosshair"
                        x1={chart.x(hovered)}
                        x2={chart.x(hovered)}
                        y1={chart.plotTop}
                        y2={chart.plotBottom}
                    ></line>
                {/if}
                {#each chart.lines as line (line.playerId)}
                    <path class="line" d={line.path} stroke={colors.get(line.playerId)}></path>
                {/each}
                {#if hoveredPoint && hovered !== undefined}
                    {#each players as player (player.playerId)}
                        <circle
                            class="marker"
                            cx={chart.x(hovered)}
                            cy={chart.y(hoveredPoint.wealth[player.playerId] ?? 0)}
                            r="4"
                            fill={player.color}
                        ></circle>
                    {/each}
                {/if}
                {#each endLabels as label (label.playerId)}
                    <circle
                        cx={chart.plotRight + END_LABEL_GAP + 2}
                        cy={label.y}
                        r="3"
                        fill={label.color}
                    ></circle>
                    <text class="end-label" x={chart.plotRight + END_LABEL_GAP + 8} y={label.y + 4}
                        >{label.name}</text
                    >
                {/each}
            </svg>
            {#if hoveredPoint && hovered !== undefined}
                <div
                    class="tooltip"
                    class:flipped={chart.x(hovered) > width / 2}
                    style:left={`${chart.x(hovered)}px`}
                    style:top={`${chart.plotTop}px`}
                    role="status"
                >
                    <div class="tooltip-title">{hoveredPoint.title}</div>
                    {#each ranked as player (player.playerId)}
                        <div class="tooltip-row">
                            <span class="swatch" style:background={player.color}></span>
                            <span class="name">{player.name}</span>
                            <span class="value"
                                >{money(hoveredPoint.wealth[player.playerId] ?? 0)}</span
                            >
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
    <table class="visually-hidden">
        <caption>Each player's wealth at the start and after each round</caption>
        <thead>
            <tr>
                <th scope="col">Round</th>
                {#each players as player (player.playerId)}<th scope="col">{player.name}</th>{/each}
            </tr>
        </thead>
        <tbody>
            {#each points as point (point.id)}
                <tr>
                    <th scope="row">{point.title}</th>
                    {#each players as player (player.playerId)}
                        <td>{money(point.wealth[player.playerId] ?? 0)}</td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
</figure>

<style>
    .wealth-chart {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 260px;
        margin: 0;
        padding: 12px 12px 8px;
        box-sizing: border-box;
    }
    figcaption {
        font-size: 13px;
        font-weight: 600;
        color: var(--rail-text, #786550);
        margin-bottom: 8px;
    }
    .plot {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        touch-action: pan-y;
    }
    svg {
        position: absolute;
        inset: 0;
        display: block;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
    }
    .grid {
        stroke: var(--rail-border, #d2c5b7);
        stroke-width: 1;
        opacity: 0.6;
    }
    .grid.baseline {
        opacity: 1;
    }
    .value-label,
    .round-label {
        fill: var(--rail-muted, #887969);
    }
    .end-label {
        fill: var(--rail-text, #786550);
        font-size: 12px;
    }
    .line {
        fill: none;
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
    }
    .crosshair {
        stroke: var(--rail-muted, #887969);
        stroke-width: 1;
    }
    .marker {
        stroke: var(--rail-surface, #faf6ee);
        stroke-width: 2;
    }
    .tooltip {
        position: absolute;
        transform: translateX(12px);
        pointer-events: none;
        min-width: 150px;
        padding: 6px 8px;
        border: 1px solid var(--rail-border, #d2c5b7);
        border-radius: 6px;
        background: var(--rail-surface-raised, #f0e7d9);
        box-shadow: 0 2px 8px var(--rail-shadow, #00000026);
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .tooltip.flipped {
        transform: translateX(calc(-100% - 12px));
    }
    .tooltip-title {
        font-weight: 600;
        margin-bottom: 4px;
    }
    .tooltip-row {
        display: grid;
        grid-template-columns: 10px 1fr auto;
        align-items: center;
        gap: 6px;
        line-height: 1.5;
    }
    .swatch {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }
    .value {
        font-variant-numeric: tabular-nums;
        text-align: right;
    }
    .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
</style>

<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { PlayerScoreHistory } from '$lib/model/scoreHistory.js'
    import { plotScoreHistory } from '$lib/model/scoreHistoryPlot.js'

    let {
        series,
        hoveredIndex = $bindable(null)
    }: {
        series: PlayerScoreHistory[]
        hoveredIndex?: number | null
    } = $props()

    const title = 'Power points by round'
    const surfaceColor = '#e4dcc4'

    const gameSession = getGameSession()

    const frame = {
        width: 280,
        height: 150,
        inset: { top: 8, right: 14, bottom: 22, left: 30 }
    }

    const plot = $derived(plotScoreHistory(series, frame))
    const finalIndex = $derived(plot.rounds.length - 1)

    const hoveredRound = $derived(hoveredIndex === null ? undefined : plot.rounds[hoveredIndex])

    function trackPointer(event: PointerEvent & { currentTarget: SVGSVGElement }) {
        const bounds = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - bounds.left) / bounds.width) * frame.width
        hoveredIndex = plot.nearestRoundIndex(x)
    }

    const color = (playerId: string) => gameSession.colors.getPlayerUiColor(playerId)
    const name = (playerId: string) => gameSession.getPlayerName(playerId)
</script>

<figure class="score-history">
    <figcaption class="caption">{title}</figcaption>
    <svg
        viewBox="0 0 {frame.width} {frame.height}"
        role="img"
        aria-label="{title}, rounds 1 to {finalIndex} and the final score"
        onpointermove={trackPointer}
        onpointerdown={trackPointer}
        onpointerleave={() => (hoveredIndex = null)}
    >
        {#each plot.scoreTicks as tick (tick.score)}
            <line
                class="grid"
                x1={frame.inset.left}
                x2={frame.width - frame.inset.right}
                y1={tick.y}
                y2={tick.y}
            ></line>
            <text
                class="axis-label"
                x={frame.inset.left - 6}
                y={tick.y}
                text-anchor="end"
                dominant-baseline="middle"
            >
                {tick.score}
            </text>
        {/each}
        {#each plot.rounds as { round, x }, index (round)}
            {#if index === finalIndex}
                <text class="axis-label" {x} y={frame.height - 6} text-anchor="middle">Final</text>
            {:else if (round === 1 || round % 5 === 0) && finalIndex - index > 2}
                <text class="axis-label" {x} y={frame.height - 6} text-anchor="middle">{round}</text
                >
            {/if}
        {/each}

        {#if hoveredRound}
            <line
                class="crosshair"
                x1={hoveredRound.x}
                x2={hoveredRound.x}
                y1={frame.inset.top}
                y2={frame.height - frame.inset.bottom}
            ></line>
        {/if}

        {#each plot.lines as line (line.playerId)}
            <path class="line" d={line.path} stroke={color(line.playerId)}></path>
        {/each}

        {#if hoveredIndex !== null}
            {#each plot.lines as line (line.playerId)}
                {@const point = line.points[hoveredIndex]}
                <circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill={color(line.playerId)}
                    stroke={surfaceColor}
                    stroke-width="2"
                ></circle>
            {/each}
        {/if}
    </svg>

    <ul class="legend">
        {#each series as { playerId } (playerId)}
            <li>
                <span class="swatch" style:background-color={color(playerId)}></span>
                {name(playerId)}
            </li>
        {/each}
    </ul>

    <table class="visually-hidden">
        <caption>{title}</caption>
        <thead>
            <tr>
                <th scope="col">Round</th>
                {#each series as { playerId } (playerId)}
                    <th scope="col">{name(playerId)}</th>
                {/each}
            </tr>
        </thead>
        <tbody>
            {#each plot.rounds as { round }, index (round)}
                <tr>
                    <th scope="row">{index === finalIndex ? 'Final' : round}</th>
                    {#each series as { playerId, scores } (playerId)}
                        <td>{scores[index]}</td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
</figure>

<style>
    .score-history {
        margin: 0;
        font-size: 0.75rem;
    }

    .caption {
        margin-bottom: 0.25rem;
        font-weight: 600;
        text-align: center;
        opacity: 0.85;
    }

    svg {
        display: block;
        width: 100%;
        height: auto;
        touch-action: pan-y;
        overflow: visible;
    }

    .grid {
        stroke: currentColor;
        stroke-opacity: 0.15;
        stroke-width: 1;
    }

    .axis-label {
        fill: currentColor;
        fill-opacity: 0.6;
        font-size: 9px;
    }

    .crosshair {
        stroke: currentColor;
        stroke-opacity: 0.4;
        stroke-width: 1;
        stroke-dasharray: 2 2;
    }

    .line {
        fill: none;
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    .legend {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.25rem 0.75rem;
        margin: 0.375rem 0 0;
        padding: 0;
        list-style: none;
    }

    .legend li {
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }

    .swatch {
        display: inline-block;
        width: 0.75rem;
        height: 3px;
        border-radius: 2px;
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

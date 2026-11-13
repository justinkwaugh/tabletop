<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    // As on the printed board: green, orange and red for the borders opening after dividends 1–3.
    const BORDER_COLORS = ['#2e7d32', '#d9730d', '#b0262e']

    const borders = $derived(
        (boardLayout(gameSession.gameState.mapId).spec.closedBorders ?? []).map((border) => ({
            ...border,
            path: border.points
                .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
                .join(' '),
            color: BORDER_COLORS[Math.min(border.opensAfterDividend, BORDER_COLORS.length) - 1],
            open: gameSession.gameState.dividendsPaid >= border.opensAfterDividend
        }))
    )
</script>

<g class="border-layer" aria-label="Closed borders">
    {#each borders as border (border.opensAfterDividend)}
        <g class:open={border.open} style:--border-color={border.color}>
            <title
                >{border.open
                    ? `Open since dividend ${border.opensAfterDividend}`
                    : `Links across this border cannot be built until dividend ${border.opensAfterDividend} has been paid`}</title
            >
            <path d={border.path} class="line"></path>
            <text
                x={border.label.x}
                y={border.label.y}
                transform={border.label.rotate
                    ? `rotate(${border.label.rotate} ${border.label.x} ${border.label.y})`
                    : undefined}
                class="caption"
                >{border.open
                    ? `open since dividend ${border.opensAfterDividend}`
                    : `closed until dividend ${border.opensAfterDividend}`}</text
            >
        </g>
    {/each}
</g>

<style>
    .line {
        fill: none;
        stroke: var(--border-color);
        stroke-width: 2.5;
        stroke-dasharray: 9 6;
        stroke-linecap: round;
    }

    .caption {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 12px;
        font-style: italic;
        font-weight: 700;
        fill: var(--border-color);
        text-anchor: middle;
        paint-order: stroke;
        stroke: #f4ead0;
        stroke-width: 4px;
        stroke-linejoin: round;
    }

    .open .line {
        stroke-width: 1.5;
        opacity: 0.45;
    }

    .open .caption {
        font-weight: 400;
        opacity: 0.6;
    }
</style>

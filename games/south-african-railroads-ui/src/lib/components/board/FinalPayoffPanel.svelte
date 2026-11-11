<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const panel = $derived(boardLayout(gameSession.gameState.mapId).finalPayoff)
    const rounds = $derived(gameSession.gameState.rounds())
</script>

<g transform="translate({panel.x} {panel.y})" aria-label="Final payoff">
    <title>Paid instead of the {rounds}th dividend; the game then ends</title>
    <rect width={panel.width} height={panel.height} rx="8" class="sheet"></rect>
    <text x={panel.width / 2} y="24" class="title">Final Payoff</text>
    <line x1="12" x2={panel.width - 12} y1="34" y2="34" class="rule"></line>
    <text x={panel.width / 2} y="55" class="body"
        >Instead of dividend {rounds}, each share pays</text
    >
    <text x={panel.width / 2} y="78" class="formula">(value + income) ÷ shares sold</text>
    <text x={panel.width / 2} y="99" class="body">rounded up. The richest investor wins.</text>
</g>

<style>
    .sheet {
        fill: #f7efd9;
        stroke: #384f6c;
        stroke-width: 2;
    }

    .title {
        font-family: 'SAR Oswald', 'Arial Narrow', sans-serif;
        font-size: 19px;
        font-weight: 500;
        letter-spacing: 0.06em;
        fill: #18222f;
        text-anchor: middle;
    }

    .rule {
        stroke: #577ba8;
        stroke-width: 1;
    }

    .body {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13.5px;
        font-style: italic;
        fill: #28394d;
        text-anchor: middle;
    }

    .formula {
        font-family: 'SAR Oswald', 'Arial Narrow', sans-serif;
        font-size: 17px;
        font-weight: 500;
        letter-spacing: 0.06em;
        fill: #18222f;
        text-anchor: middle;
    }
</style>

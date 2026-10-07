<script lang="ts">
    import { DIVIDEND_RULES_RECT } from '$lib/utils/boardLayout.js'

    const LINES = [
        'Dividend per share = company value ÷ shares held by players, rounded up',
        'Grocer value = $1 per store in a city + $2 per development in those cities ($3 for Complete Comestibles)',
        'Balcones Builders value = $1 per development anywhere on the map'
    ]
</script>

<g transform="translate({DIVIDEND_RULES_RECT.x} {DIVIDEND_RULES_RECT.y})">
    <rect
        width={DIVIDEND_RULES_RECT.width}
        height={DIVIDEND_RULES_RECT.height}
        rx="10"
        class="panel"
    />
    <text x="14" y="22" class="title"
        >Dividends · paid when the 11th space fills, and once more at game end</text
    >
    {#each LINES as line, index (line)}
        <text x="14" y={42 + index * 17} class="line">{line}</text>
    {/each}
</g>

<style>
    .panel {
        fill: #fdf8ec;
        stroke: #7a1d22;
        stroke-width: 2;
    }

    .title {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        fill: #7a1d22;
    }

    .line {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13.5px;
        fill: #2b1a10;
    }
</style>

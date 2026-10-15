<script lang="ts">
    import { HexKind } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LEGEND_RECT, hexPoints } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const edition = $derived(gameSession.gameState.edition.definition)
    const capacity = $derived(edition.siteCapacity(Math.max(1, gameSession.gameState.round()), undefined))
    const entries = $derived([
        { fill: '#e9dc3f', cost: edition.trackCost(HexKind.Industry, 0), note: '+ level', limit: capacity },
        { fill: '#de8a1d', cost: edition.trackCost(HexKind.Town, 0), note: '+3', limit: capacity },
        { fill: '#df3f2b', cost: edition.trackCost(HexKind.City, 0), note: '+5', limit: capacity },
        { fill: '#83a35a', cost: edition.trackCost(HexKind.Countryside, 0), note: 'cube $1', limit: 1 }
    ])
</script>

<g transform="translate({LEGEND_RECT.x} {LEGEND_RECT.y})">
    <rect width={LEGEND_RECT.width} height={LEGEND_RECT.height} rx="8" class="sheet" />
    <text x={LEGEND_RECT.width / 2} y="17" class="title">Track</text>
    {#each entries as entry, index (index)}
        <g transform="translate({6 + index * 76} 28)">
            <text x="36" y="10" class="cost">${entry.cost}</text>
            <polygon points={hexPoints({ x: 36, y: 40 }, 18)} fill={entry.fill} stroke="#1d1d1b" stroke-width="2" />
            <text x="36" y="72" class="note">{entry.note}</text>
            <text x="36" y="84" class="note">max {entry.limit} disc{entry.limit === 1 ? '' : 's'}</text>
        </g>
    {/each}
</g>

<style>
    .sheet {
        fill: #f6f2da;
        stroke: #4a5a24;
        stroke-width: 2;
    }

    .title {
        fill: #26300f;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        text-anchor: middle;
    }

    .cost {
        fill: #a3311d;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        text-anchor: middle;
    }

    .note {
        fill: #26300f;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 10px;
        text-anchor: middle;
    }

    text {
        pointer-events: none;
    }
</style>

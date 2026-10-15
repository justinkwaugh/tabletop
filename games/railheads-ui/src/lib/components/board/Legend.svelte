<script lang="ts">
    import { HexKind } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LEGEND_RECT, hexPoints } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const ROW = 26
    const HEADER_Y = 40
    const FIRST_ROW_Y = 50

    const edition = $derived(gameSession.gameState.edition.definition)
    const rows = $derived([
        { name: 'Industry', fill: '#e9dc3f', kind: HexKind.Industry },
        { name: 'Town', fill: '#de8a1d', kind: HexKind.Town },
        { name: 'City', fill: '#df3f2b', kind: HexKind.City },
        { name: 'Country', fill: '#83a35a', kind: HexKind.Countryside }
    ].map((row) => ({
        ...row,
        disc: edition.trackCost(row.kind, 0),
        cube: row.kind === HexKind.Countryside ? edition.crossingCubeCost : undefined
    })))
</script>

<g transform="translate({LEGEND_RECT.x} {LEGEND_RECT.y})">
    <rect width={LEGEND_RECT.width} height={LEGEND_RECT.height} rx="8" class="sheet" />
    <text x={LEGEND_RECT.width / 2} y="19" class="title">Track Cost</text>
    <text x="140" y={HEADER_Y} class="head">Disc</text>
    <text x="196" y={HEADER_Y} class="head">Cube</text>
    <line x1="10" x2={LEGEND_RECT.width - 10} y1={HEADER_Y + 5} y2={HEADER_Y + 5} class="rule" />
    {#each rows as row, index (row.kind)}
        <g transform="translate(0 {FIRST_ROW_Y + index * ROW})">
            <polygon points={hexPoints({ x: 24, y: 12 }, 11)} fill={row.fill} stroke="#1d1d1b" stroke-width="1.5" />
            <text x="42" y="17" class="label">{row.name}</text>
            <text x="140" y="17" class="cost">{gameSession.money(row.disc)}</text>
            <text x="196" y="17" class="cost">{row.cube === undefined ? '–' : gameSession.money(row.cube)}</text>
        </g>
    {/each}
    <line
        x1="10"
        x2={LEGEND_RECT.width - 10}
        y1={FIRST_ROW_Y + rows.length * ROW + 2}
        y2={FIRST_ROW_Y + rows.length * ROW + 2}
        class="rule"
    />
    <text x={LEGEND_RECT.width / 2} y={LEGEND_RECT.height - 10} class="foot">Max 1 disc per company per hex</text>
</g>

<style>
    .sheet {
        fill: #f6f2da;
        stroke: #4a5a24;
        stroke-width: 2;
    }

    .rule {
        stroke: #8f8a5c;
        stroke-width: 1;
    }

    .title {
        fill: #26300f;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
        text-anchor: middle;
    }

    .head,
    .cost {
        text-anchor: middle;
    }

    .head {
        fill: #5b5a36;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
    }

    .label {
        fill: #26300f;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
    }

    .cost {
        fill: #a3311d;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
    }

    .foot {
        fill: #26300f;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 10px;
        text-anchor: middle;
    }

    text {
        pointer-events: none;
    }
</style>

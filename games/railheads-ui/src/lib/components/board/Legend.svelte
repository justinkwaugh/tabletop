<script lang="ts">
    import { HexKind } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LEGEND_RECT, hexPoints } from '$lib/utils/boardLayout.js'
    import { HEX_FILL } from '$lib/utils/companyStyle.js'

    const gameSession = getGameSession()

    const ROW = 26
    const HEADER_Y = 40
    const FIRST_ROW_Y = 50
    const DISC_X = 118
    const CUBE_X = 164
    const MAX_X = 212
    const SITE_ROWS = 3

    const edition = $derived(gameSession.gameState.edition.definition)
    const siteMax = $derived(
        edition.siteCapacity(Math.max(gameSession.gameState.round(), 1), undefined)
    )
    const rows = $derived(
        [
            { name: 'Industry', kind: HexKind.Industry },
            { name: 'Town', kind: HexKind.Town },
            { name: 'City', kind: HexKind.City },
            { name: 'Country', kind: HexKind.Countryside }
        ].map((row) => ({
            ...row,
            disc: edition.trackCost(row.kind, 0),
            cube: row.kind === HexKind.Countryside ? edition.crossingCubeCost : undefined
        }))
    )
</script>

<g transform="translate({LEGEND_RECT.x} {LEGEND_RECT.y})">
    <rect width={LEGEND_RECT.width} height={LEGEND_RECT.height} rx="8" class="sheet" />
    <text x={LEGEND_RECT.width / 2} y="19" class="title">Track Cost</text>
    <text x={DISC_X} y={HEADER_Y} class="head">Disc</text>
    <text x={CUBE_X} y={HEADER_Y} class="head">Cube</text>
    <text x={MAX_X} y={HEADER_Y} class="head">Max</text>
    <line x1="10" x2={LEGEND_RECT.width - 10} y1={HEADER_Y + 5} y2={HEADER_Y + 5} class="rule" />
    {#each rows as row, index (row.kind)}
        <g transform="translate(0 {FIRST_ROW_Y + index * ROW})">
            <polygon
                points={hexPoints({ x: 24, y: 12 }, 11)}
                fill={HEX_FILL[row.kind]}
                stroke="#1d1d1b"
                stroke-width="1.5"
            />
            <text x="42" y="17" class="label">{row.name}</text>
            <text x={DISC_X} y="17" class="cost">${row.disc}</text>
            <text x={CUBE_X} y="17" class="cost"
                >{row.cube === undefined ? '–' : `$${row.cube}`}</text
            >
        </g>
    {/each}
    <g aria-label="Site hexes hold up to {siteMax} discs this round">
        <rect
            x={MAX_X - 13}
            y={FIRST_ROW_Y + 1}
            width="26"
            height={SITE_ROWS * ROW - 4}
            rx="6"
            class="site-max"
        />
        <text x={MAX_X} y={FIRST_ROW_Y + (SITE_ROWS * ROW) / 2 + 5} class="site-max-value"
            >{siteMax}</text
        >
    </g>
    <text x={MAX_X} y={FIRST_ROW_Y + SITE_ROWS * ROW + 17} class="cost">1</text>
    <line
        x1="10"
        x2={LEGEND_RECT.width - 10}
        y1={FIRST_ROW_Y + rows.length * ROW + 2}
        y2={FIRST_ROW_Y + rows.length * ROW + 2}
        class="rule"
    />
    <text x={LEGEND_RECT.width / 2} y={LEGEND_RECT.height - 20} class="foot"
        >Site limit rises by 1 each round</text
    >
    <text x={LEGEND_RECT.width / 2} y={LEGEND_RECT.height - 7} class="foot"
        >Each company: max 1 disc per hex</text
    >
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
        fill: #26300f;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
    }

    .site-max {
        fill: #33401a;
    }

    .site-max-value {
        fill: #f4f0d8;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 18px;
        font-weight: 700;
        text-anchor: middle;
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

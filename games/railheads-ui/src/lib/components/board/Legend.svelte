<script lang="ts">
    import { HexKind } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { editionStyle } from '$lib/utils/editionStyle.js'

    const gameSession = getGameSession()

    const ROW = 26
    const HEADER_Y = 40
    const FIRST_ROW_Y = 50
    const SITE_ROWS = 3

    const layout = $derived(boardLayout(gameSession.gameState.editionId))
    const panel = $derived(layout.legend)
    const fill = $derived(editionStyle(gameSession.gameState.editionId).hexFill)
    const discX = $derived(panel.width - 122)
    const cubeX = $derived(panel.width - 76)
    const maxX = $derived(panel.width - 28)
    const edition = $derived(gameSession.gameState.edition.definition)
    const round = $derived(Math.max(gameSession.gameState.round(), 1))
    const siteMax = $derived(edition.siteCapacity(round, undefined))
    const limitRises = $derived(
        round < edition.rounds && edition.siteCapacity(round + 1, undefined) > siteMax
    )
    const perDiscBeneath = $derived(
        edition.trackCost(HexKind.City, 1, 1) - edition.trackCost(HexKind.City, 0, 1)
    )
    // The board's terrain: sites, then the one-disc hexes this title has.
    const tollKind = $derived(edition.map.tolls?.[0]?.kind)
    const terrain = $derived([
        { name: 'Industry', kind: HexKind.Industry },
        { name: 'Town', kind: HexKind.Town },
        { name: 'City', kind: HexKind.City },
        { name: 'Country', kind: HexKind.Countryside },
        ...((edition.map.hillside ?? []).length > 0
            ? [{ name: 'Hillside', kind: HexKind.Hillside }]
            : []),
        ...(tollKind === HexKind.Tunnel ? [{ name: 'Tunnel', kind: HexKind.Tunnel }] : []),
        ...(tollKind === HexKind.Bridge ? [{ name: 'Bridge', kind: HexKind.Bridge }] : [])
    ])
    const footnotes = $derived(
        [
            limitRises
                ? 'Site limit rises by 1 each round'
                : perDiscBeneath > 0
                  ? `* +$${perDiscBeneath} per disc already there`
                  : (edition.map.peaks ?? []).length > 0
                    ? 'No track on the Alps or lakes'
                    : '',
            'Each company: max 1 disc per hex'
        ].filter((line) => line !== '')
    )
    const isSite = (kind: HexKind) =>
        kind === HexKind.Industry || kind === HexKind.Town || kind === HexKind.City
    // A tunnel's price is per hex it spans.
    const perHex = (kind: HexKind) => (kind === HexKind.Tunnel ? '×' : '')
    const rows = $derived(
        terrain.map((row) => ({
            ...row,
            disc: `$${edition.trackCost(row.kind, 0, 1)}${perHex(row.kind)}${isSite(row.kind) && perDiscBeneath > 0 ? '*' : ''}`,
            cube: isSite(row.kind)
                ? undefined
                : `$${edition.crossingCubeCost(row.kind, 1)}${perHex(row.kind)}`
        }))
    )
</script>

<g transform="translate({panel.x} {panel.y})">
    <rect width={panel.width} height={panel.height} rx="8" class="sheet"></rect>
    <text x={panel.width / 2} y="19" class="title">Track Cost</text>
    <text x={discX} y={HEADER_Y} class="head">Disc</text>
    <text x={cubeX} y={HEADER_Y} class="head">Cube</text>
    <text x={maxX} y={HEADER_Y} class="head">Max</text>
    <line x1="10" x2={panel.width - 10} y1={HEADER_Y + 5} y2={HEADER_Y + 5} class="rule"></line>
    {#each rows as row, index (row.kind)}
        <g transform="translate(0 {FIRST_ROW_Y + index * ROW})">
            <polygon
                points={layout.hexPoints({ x: 24, y: 12 }, 11)}
                fill={fill[row.kind]}
                stroke="#1d1d1b"
                stroke-width="1.5"
            ></polygon>
            <text x="42" y="17" class="label">{row.name}</text>
            <text x={discX} y="17" class="cost">{row.disc}</text>
            <text x={cubeX} y="17" class="cost">{row.cube ?? '–'}</text>
        </g>
    {/each}
    <g aria-label="Site hexes hold up to {siteMax} discs{limitRises ? ' this round' : ''}">
        <rect
            x={maxX - 13}
            y={FIRST_ROW_Y + 1}
            width="26"
            height={SITE_ROWS * ROW - 4}
            rx="6"
            class="site-max"
        ></rect>
        <text x={maxX} y={FIRST_ROW_Y + (SITE_ROWS * ROW) / 2 + 5} class="site-max-value"
            >{siteMax}</text
        >
    </g>
    {#each rows.slice(SITE_ROWS) as row, index (row.kind)}
        <text x={maxX} y={FIRST_ROW_Y + (SITE_ROWS + index) * ROW + 17} class="cost">1</text>
    {/each}
    <line
        x1="10"
        x2={panel.width - 10}
        y1={FIRST_ROW_Y + rows.length * ROW + 2}
        y2={FIRST_ROW_Y + rows.length * ROW + 2}
        class="rule"
    ></line>
    {#each footnotes as footnote, index (footnote)}
        <text x={panel.width / 2} y={panel.height - 20 + index * 13} class="foot">{footnote}</text>
    {/each}
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
        font-family: 'Railheads Baskerville', Georgia, serif;
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
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
    }

    .label {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 13px;
    }

    .cost {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
    }

    .site-max {
        fill: #33401a;
    }

    .site-max-value {
        fill: #f4f0d8;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 18px;
        font-weight: 700;
        text-anchor: middle;
    }

    .foot {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 10px;
        text-anchor: middle;
    }

    text {
        pointer-events: none;
    }
</style>

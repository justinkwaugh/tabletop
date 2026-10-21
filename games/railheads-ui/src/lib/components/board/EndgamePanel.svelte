<script lang="ts">
    import { CompanyId, EditionId, HexKind, STATE_SUBSIDIES } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import { editionStyle } from '$lib/utils/editionStyle.js'

    const gameSession = getGameSession()

    const DISC_RX = 9
    const DISC_RY = 6
    const DISC_THICKNESS = 4
    const SUBSIDY_ROW = 12.5
    const SUBSIDY_ROWS = 6

    const editionId = $derived(gameSession.gameState.editionId)
    const layout = $derived(boardLayout(editionId))
    const panel = $derived(layout.endgame)
    const style = $derived(editionStyle(editionId))
    const definition = $derived(gameSession.gameState.edition.definition)
    const perSite = $derived(definition.industryBonusPerSite)
    const stack = [CompanyId.KPEV, CompanyId.KSSE, CompanyId.GBSE]
    const subsidies = STATE_SUBSIDIES.map((perShare, states) => ({ states, perShare })).slice(1)
    const industryTop = $derived(editionId === EditionId.Midwest ? panel.height - 70 : 98)
</script>

<g
    transform="translate({panel.x} {panel.y})"
    aria-label="Game-end bonuses, paid after the final payout"
>
    <title>Paid after the final payout of round {definition.rounds}</title>
    <rect width={panel.width} height={panel.height} rx="8" class="sheet" />
    <text x={panel.width / 2} y="18" class="title">Game End Bonus</text>

    {#if editionId === EditionId.Midwest}
        <text x="10" y="40" class="subtitle">{style.endBonusName} · per share</text>
        {#each subsidies as row, index (row.states)}
            {@const x = Math.floor(index / SUBSIDY_ROWS) * (panel.width / 2)}
            {@const y = 58 + (index % SUBSIDY_ROWS) * SUBSIDY_ROW}
            <text x={x + 26} {y} class="amount">{row.states}</text>
            <text x={x + 30} {y} class="body leader">{row.states === 1 ? 'state' : 'states'}</text>
            <text x={x + panel.width / 2 - 8} {y} class="amount">${row.perShare}</text>
        {/each}
    {:else}
        <text x="10" y="40" class="subtitle">Railroad · per share</text>
        <polygon
            points={layout.hexPoints({ x: 26, y: 68 }, 18)}
            fill={style.hexFill[HexKind.Town]}
            stroke="#1d1d1b"
            stroke-width="1.5"
        />
        {#each stack as companyId, index (companyId)}
            {@const y = 74 - index * 6}
            {@const company = COMPANY_STYLE[companyId]}
            <path
                d="M {26 - DISC_RX} {y} L {26 - DISC_RX} {y +
                    DISC_THICKNESS} A {DISC_RX} {DISC_RY} 0 0 0 {26 + DISC_RX} {y +
                    DISC_THICKNESS} L {26 + DISC_RX} {y} Z"
                fill={company.edge}
                stroke={company.edge}
            />
            <ellipse
                cx="26"
                cy={y}
                rx={DISC_RX}
                ry={DISC_RY}
                fill={company.fill}
                stroke={company.edge}
            />
        {/each}
        <text x="52" y="58" class="body">Top disc earns</text>
        <text x="52" y="71" class="body">$1 a share per</text>
        <text x="52" y="84" class="body">disc beneath</text>
    {/if}

    <g transform="translate(0 {industryTop})">
        <line x1="10" x2={panel.width - 10} y1="0" y2="0" class="rule" />
        <text x="10" y="18" class="subtitle">Industry · per token</text>
        <polygon
            points={layout.hexPoints({ x: 26, y: 44 }, 18)}
            fill={style.hexFill[HexKind.Industry]}
            stroke="#1d1d1b"
            stroke-width="1.5"
        />
        <text x="26" y="49" class="plus">${perSite}</text>
        <text x="52" y="34" class="body">${perSite} per site</text>
        <text x="52" y="47" class="body">reached, split</text>
        <text x="52" y="60" class="body">across tokens</text>
    </g>
</g>

<style>
    .sheet {
        fill: #f6f2da;
        stroke: #4a5a24;
        stroke-width: 2;
    }

    .rule {
        stroke: #c9c493;
        stroke-width: 1;
    }

    .title {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        text-anchor: middle;
    }

    .subtitle {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
    }

    .body {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 11px;
    }

    .leader {
        font-size: 8px;
        fill: #6d6a45;
    }

    .amount {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
        text-anchor: end;
    }

    .plus {
        fill: #26300f;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        text-anchor: middle;
    }

    text {
        pointer-events: none;
    }
</style>

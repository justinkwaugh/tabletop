<script lang="ts">
    import { CompanyId, HexKind } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ENDGAME_RECT, hexPoints } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE, HEX_FILL } from '$lib/utils/companyStyle.js'

    const gameSession = getGameSession()

    const DISC_RX = 9
    const DISC_RY = 6
    const DISC_THICKNESS = 4

    const definition = $derived(gameSession.gameState.edition.definition)
    const perSite = $derived(definition.industryBonusPerSite)
    const stack = [CompanyId.KPEV, CompanyId.KSSE, CompanyId.GBSE]
</script>

<g
    transform="translate({ENDGAME_RECT.x} {ENDGAME_RECT.y})"
    aria-label="Game-end bonuses, paid after the final payout"
>
    <title>Paid after the final payout of round {definition.rounds}</title>
    <rect width={ENDGAME_RECT.width} height={ENDGAME_RECT.height} rx="8" class="sheet" />
    <text x={ENDGAME_RECT.width / 2} y="18" class="title">Game End Bonus</text>

    <text x="10" y="40" class="subtitle">Railroad · per share</text>
    <polygon
        points={hexPoints({ x: 26, y: 68 }, 18)}
        fill={HEX_FILL[HexKind.Town]}
        stroke="#1d1d1b"
        stroke-width="1.5"
    />
    {#each stack as companyId, index (companyId)}
        {@const y = 74 - index * 6}
        {@const style = COMPANY_STYLE[companyId]}
        <path
            d="M {26 - DISC_RX} {y} L {26 - DISC_RX} {y +
                DISC_THICKNESS} A {DISC_RX} {DISC_RY} 0 0 0 {26 + DISC_RX} {y +
                DISC_THICKNESS} L {26 + DISC_RX} {y} Z"
            fill={style.edge}
            stroke={style.edge}
        />
        <ellipse cx="26" cy={y} rx={DISC_RX} ry={DISC_RY} fill={style.fill} stroke={style.edge} />
    {/each}
    <text x="52" y="58" class="body">Top disc earns</text>
    <text x="52" y="71" class="body">$1 a share per</text>
    <text x="52" y="84" class="body">disc beneath</text>

    <line x1="10" x2={ENDGAME_RECT.width - 10} y1="98" y2="98" class="rule" />

    <text x="10" y="116" class="subtitle">Industry · per token</text>
    <polygon
        points={hexPoints({ x: 26, y: 142 }, 18)}
        fill={HEX_FILL[HexKind.Industry]}
        stroke="#1d1d1b"
        stroke-width="1.5"
    />
    <text x="26" y="147" class="plus">${perSite}</text>
    <text x="52" y="132" class="body">${perSite} per site</text>
    <text x="52" y="145" class="body">reached, split</text>
    <text x="52" y="158" class="body">across tokens</text>
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

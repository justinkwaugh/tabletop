<script lang="ts">
    import { SettlementKind, type PointSettlementKind } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { SETTLEMENT_SYMBOLS, UNOWNED_BASE_FILL } from '$lib/utils/settlementSymbols.js'
    import SettlementSymbol from './SettlementSymbol.svelte'

    const gameSession = getGameSession()

    const KINDS: PointSettlementKind[] = [
        SettlementKind.AgriculturalRailhead,
        SettlementKind.MercantileCenter,
        SettlementKind.RailroadStation,
        SettlementKind.RailroadBase,
        SettlementKind.NaturalResource,
        SettlementKind.Town,
        SettlementKind.City,
        SettlementKind.Mine,
        SettlementKind.Port
    ]
    const LEGEND_SCALE = 0.7

    const BASE_X = 131
    const DEVELOPED_X = 188
    const ROW_PITCH = 34
    const FIRST_ROW_Y = 40

    const origin = $derived(boardLayout(gameSession.gameState.mapId).spec.legend)
    const rows = $derived.by(() => {
        const incomes = gameSession.gameState.map.definition.settlementIncome
        return KINDS.flatMap((kind) => {
            const levels = incomes[kind]
            const symbol = SETTLEMENT_SYMBOLS[kind]
            return levels
                ? [{ kind, levels, name: symbol.name, fill: symbol.fill ?? UNOWNED_BASE_FILL }]
                : []
        })
    })
</script>

<g transform="translate({origin.x} {origin.y})" class="legend" text-rendering="geometricPrecision">
    <text x={BASE_X} y="12" class="heading">Base</text>
    <text x={DEVELOPED_X} y="12" class="heading">Developed</text>
    <line x1="0" y1="20" x2="224" y2="20" class="rule"></line>
    {#each rows as entry, index (entry.kind)}
        <g transform="translate(0 {FIRST_ROW_Y + index * ROW_PITCH})">
            <g transform="translate(14 0)">
                <SettlementSymbol
                    kind={entry.kind}
                    fill={entry.fill}
                    size={SETTLEMENT_SYMBOLS[entry.kind].size * LEGEND_SCALE}
                    strokeWidth={1.4}
                />
            </g>
            {#if entry.name[1]}
                <text x="34" y="-3" class="name">{entry.name[0]}</text>
                <text x="34" y="11" class="name">{entry.name[1]}</text>
            {:else}
                <text x="34" y="5" class="name">{entry.name[0]}</text>
            {/if}
            <text x={BASE_X} y="5" class="amount">${entry.levels[0]}</text>
            <text x={DEVELOPED_X} y="5" class="amount"
                >${entry.levels[entry.levels.length - 1]}</text
            >
        </g>
    {/each}
</g>

<style>
    .heading {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        text-anchor: middle;
        fill: #18222f;
    }

    .rule {
        stroke: #2f445c;
        stroke-width: 1;
    }

    .name {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        fill: #18222f;
    }

    .amount {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 16px;
        font-weight: 700;
        text-anchor: middle;
        fill: #18222f;
    }
</style>

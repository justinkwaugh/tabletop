<script lang="ts">
    import type { Antique } from '@tabletop/marracash'
    import MarketMark from '$lib/components/MarketMark.svelte'
    import { MarketPalettes } from '$lib/utils/marketColors.js'

    let { card, dimmed = false }: { card: Antique; dimmed?: boolean } = $props()

    let palette = $derived(MarketPalettes[card.color])
</script>

<svg
    width="34"
    height="44"
    viewBox="0 0 34 44"
    role="img"
    aria-label="{card.color} antique worth {card.value}"
    class:opacity-45={dimmed}
>
    <rect x="1" y="1" width="32" height="42" rx="5" fill={palette.tint} stroke={palette.stroke} stroke-width="2" />
    <MarketMark color={card.color} x={17} y={14} size={14} />
    <text x="17" y="36" text-anchor="middle" font-size="11" font-weight="700" fill={palette.stroke}
        >{card.value}</text
    >
</svg>

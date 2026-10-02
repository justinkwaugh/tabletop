<script lang="ts">
    import type { Antique } from '@tabletop/marracash'
    import MarketMark from '$lib/components/MarketMark.svelte'
    import { MarketPalettes } from '$lib/utils/marketColors.js'
    import { withLightness } from '$lib/utils/colorLightness.js'

    let { card, dimmed = false }: { card: Antique; dimmed?: boolean } = $props()

    const InkLightness = 0.15
    const CardWidth = 34
    const CardHeight = 44
    const DisplayScale = 1.15

    let palette = $derived(MarketPalettes[card.color])
    let ink = $derived(withLightness(palette.fill, InkLightness))
</script>

<svg
    width={CardWidth * DisplayScale}
    height={CardHeight * DisplayScale}
    viewBox="0 0 {CardWidth} {CardHeight}"
    role="img"
    aria-label="{card.color} antique worth {card.value}"
    class:opacity-45={dimmed}
>
    <rect
        x="1"
        y="1"
        width={CardWidth - 2}
        height={CardHeight - 2}
        rx="5"
        fill={palette.tint}
        stroke={ink}
        stroke-width="2"
    ></rect>
    <MarketMark color={card.color} x={CardWidth / 2} y={14} size={14} filled />
    <text x={CardWidth / 2} y="36" text-anchor="middle" font-size="11" font-weight="700" fill={ink}
        >{card.value}</text
    >
</svg>

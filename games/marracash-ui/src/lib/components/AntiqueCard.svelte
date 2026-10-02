<script lang="ts">
    import type { Antique } from '@tabletop/marracash'
    import MarketSwatch from '$lib/components/MarketSwatch.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { withLightness } from '$lib/utils/colorLightness.js'

    let { card, dimmed = false }: { card: Antique; dimmed?: boolean } = $props()
    const gameSession = getGameSession()

    const InkLightness = 0.15
    const CardWidth = 34
    const CardHeight = 44
    const DisplayScale = 1.15

    let palette = $derived(gameSession.marketPalettes[card.color])
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
    <MarketSwatch color={card.color} x={CardWidth / 2} y={14} size={14} />
    <text x={CardWidth / 2} y="36" text-anchor="middle" font-size="11" font-weight="700" fill={ink}
        >{card.value}</text
    >
</svg>

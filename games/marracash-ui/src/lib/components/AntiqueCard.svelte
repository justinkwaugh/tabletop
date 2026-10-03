<script lang="ts">
    import type { Antique } from '@tabletop/marracash'
    import AntiqueItem from '$lib/components/AntiqueItem.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { mixColors, withLightness } from '$lib/utils/colorLightness.js'
    import { AntiqueItemNames } from '$lib/utils/antiqueItems.js'

    let {
        card,
        matched,
        dimmed = false
    }: { card: Antique; matched: boolean; dimmed?: boolean } = $props()
    const gameSession = getGameSession()

    const InkLightness = 0.15
    const CardWidth = 46
    const CardHeight = 62
    const ItemInset = { x: 5, y: 4 }
    const ItemScale = 0.9
    const UnmatchedPaleness = 0.65

    let palette = $derived(gameSession.marketPalettes[card.color])
    let ink = $derived(withLightness(palette.fill, InkLightness))
    let background = $derived(
        matched ? palette.tint : mixColors(palette.tint, '#ffffff', UnmatchedPaleness)
    )
</script>

<svg
    width={CardWidth}
    height={CardHeight}
    viewBox="0 0 {CardWidth} {CardHeight}"
    role="img"
    aria-label="{card.color} {AntiqueItemNames[card.color]} worth {card.value}{matched
        ? ''
        : ', not yet matched'}"
    class:opacity-45={dimmed}
>
    <rect
        x="1"
        y="1"
        width={CardWidth - 2}
        height={CardHeight - 2}
        rx="5"
        fill={background}
        stroke={palette.fill}
        stroke-width="2.5"
    ></rect>
    <g transform="translate({ItemInset.x} {ItemInset.y}) scale({ItemScale})">
        <AntiqueItem color={card.color} {matched} />
    </g>
    <text x={CardWidth / 2} y="54" text-anchor="middle" font-size="11" font-weight="700" fill={ink}
        >{card.value}</text
    >
</svg>

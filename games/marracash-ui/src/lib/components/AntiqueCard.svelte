<script lang="ts">
    import type { Antique } from '@tabletop/marracash'
    import AntiqueItem from '$lib/components/AntiqueItem.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { withLightness } from '$lib/utils/colorLightness.js'
    import { AntiqueItemNames } from '$lib/utils/antiqueItems.js'

    let {
        card,
        matched,
        dimmed = false,
        surface = 'panel'
    }: {
        card: Antique
        matched: boolean
        dimmed?: boolean
        surface?: 'panel' | 'parchment'
    } = $props()
    const gameSession = getGameSession()

    const InkLightness = 0.15
    const CardWidth = 44
    const CardHeight = 60
    const ItemInset = { x: 4, y: 3 }
    const ItemScale = 0.9
    const MatchedFace = '#f6e9c8'
    const MatchedEdge = '#c9a14a'
    const UnmatchedFace = { panel: 'rgba(0, 0, 0, 0.18)', parchment: 'rgba(0, 0, 0, 0.04)' }

    let palette = $derived(gameSession.marketPalettes[card.color])
    let ink = $derived(withLightness(palette.fill, InkLightness))
    let valueColor = $derived(matched || surface === 'parchment' ? ink : palette.tint)
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
        rx="4"
        fill={matched ? MatchedFace : UnmatchedFace[surface]}
        stroke={matched ? MatchedEdge : palette.fill}
        stroke-width="1.8"
        stroke-dasharray={matched ? undefined : '3.5 2.5'}
    ></rect>
    <g transform="translate({ItemInset.x} {ItemInset.y}) scale({ItemScale})">
        <AntiqueItem color={card.color} />
    </g>
    <text
        x={CardWidth / 2}
        y="53"
        text-anchor="middle"
        font-size="10.5"
        font-weight="700"
        fill={valueColor}>{card.value}</text
    >
</svg>

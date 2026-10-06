<script lang="ts">
    import type { Antique } from '@tabletop/marracash'
    import AntiqueItem from '$lib/components/AntiqueItem.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { AntiqueItemNames } from '$lib/utils/antiqueItems.js'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    const CardWidth = 38
    const CardHeight = 50

    let {
        card,
        covered,
        unpaid = false
    }: { card: Antique; covered: boolean; unpaid?: boolean } = $props()
    const gameSession = getGameSession()

    let palette = $derived(gameSession.marketPalettes[card.color])
</script>

<svg
    width={CardWidth}
    height={CardHeight}
    viewBox="0 0 {CardWidth} {CardHeight}"
    role="img"
    aria-label="{card.color} {AntiqueItemNames[card.color]} worth {card.value}{covered
        ? ''
        : ', not yet covered'}{unpaid ? ', not paid' : ''}"
>
    <rect
        x="1"
        y="1"
        width={CardWidth - 2}
        height={CardHeight - 2}
        rx="4"
        fill={covered ? PanelPalette.parchment : PanelPalette.glaze}
        stroke={covered ? PanelPalette.brass : palette.fill}
        stroke-width="1.75"
        stroke-dasharray={covered ? undefined : '3.5 2.5'}
    ></rect>
    <g transform="translate(2.5 2.5) scale(0.83)"><AntiqueItem color={card.color} /></g>
    <text
        x={CardWidth / 2}
        y="45"
        text-anchor="middle"
        class="marracash-merchant"
        font-size="11"
        fill={covered ? palette.stroke : PanelPalette.cream}
        text-decoration={unpaid ? 'line-through' : undefined}>{card.value}</text
    >
</svg>

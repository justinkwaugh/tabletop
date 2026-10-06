<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import PawnFigure from '$lib/components/PawnFigure.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        PawnBaseY,
        PawnHeadCenterY,
        PawnHeadRadius,
        PawnOutline,
        PawnWidth
    } from '$lib/utils/pawnShape.js'

    const Margin = 1
    const Top = PawnHeadCenterY - PawnHeadRadius - Margin
    const Bottom = PawnBaseY + 1.5 + Margin
    const Width = PawnWidth + 2 * Margin
    const Height = Bottom - Top
    const DefaultHeight = 19

    let {
        color,
        height = DefaultHeight,
        hollow = false
    }: { color: MarketColor; height?: number; hollow?: boolean } = $props()
    const gameSession = getGameSession()
</script>

<svg
    class="inline-block align-[-4px]"
    width={(height * Width) / Height}
    {height}
    viewBox="{-Width / 2} {Top} {Width} {Height}"
    aria-hidden="true"
>
    {#if hollow}
        <path
            d={PawnOutline}
            fill="none"
            stroke={gameSession.marketPalettes[color].fill}
            stroke-width="1.6"
            stroke-dasharray="3 2"
        ></path>
    {:else}
        <PawnFigure {color} highlighted={false} />
    {/if}
</svg>

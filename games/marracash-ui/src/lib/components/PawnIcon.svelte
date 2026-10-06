<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import PawnFigure from '$lib/components/PawnFigure.svelte'
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
    const PlainFill = '#8a6a46'

    let { color, height = DefaultHeight }: { color?: MarketColor; height?: number } = $props()
</script>

<svg
    class="inline-block align-[-4px]"
    width={(height * Width) / Height}
    {height}
    viewBox="{-Width / 2} {Top} {Width} {Height}"
    aria-hidden="true"
>
    {#if color}
        <PawnFigure {color} highlighted={false} />
    {:else}
        <path d={PawnOutline} fill={PlainFill}></path>
    {/if}
</svg>

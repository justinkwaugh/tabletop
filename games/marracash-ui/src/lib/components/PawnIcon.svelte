<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import PawnFigure from '$lib/components/PawnFigure.svelte'
    import { PawnBaseY, PawnHeadCenterY, PawnHeadRadius, PawnWidth } from '$lib/utils/pawnShape.js'

    const Margin = 1
    const Top = PawnHeadCenterY - PawnHeadRadius - Margin
    const Bottom = PawnBaseY + 1.5 + Margin
    const Width = PawnWidth + 2 * Margin
    const Height = Bottom - Top
    const DisplayHeight = 19

    let { color }: { color: MarketColor } = $props()
</script>

<svg
    class="inline-block align-[-4px]"
    width={(DisplayHeight * Width) / Height}
    height={DisplayHeight}
    viewBox="{-Width / 2} {Top} {Width} {Height}"
    aria-hidden="true"
>
    <PawnFigure {color} highlighted={false} />
</svg>

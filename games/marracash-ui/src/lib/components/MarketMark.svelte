<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { MarketPalettes, symbolPath } from '$lib/utils/marketColors.js'

    let {
        color,
        x,
        y,
        size,
        filled = false
    }: { color: MarketColor; x: number; y: number; size: number; filled?: boolean } = $props()

    let palette = $derived(MarketPalettes[color])
</script>

<path
    d={symbolPath(palette.symbol)}
    transform="translate({x} {y}) scale({size / 2})"
    fill={filled ? palette.fill : '#ffffff'}
    stroke={palette.stroke}
    stroke-width={2 / size}
></path>

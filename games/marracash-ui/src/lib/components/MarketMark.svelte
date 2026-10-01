<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { MarketPalettes, symbolPath } from '$lib/utils/marketColors.js'

    let {
        color,
        x,
        y,
        size
    }: { color: MarketColor; x: number; y: number; size: number } = $props()

    let palette = $derived(MarketPalettes[color])
</script>

<path
    d={symbolPath(palette.symbol)}
    transform="translate({x} {y}) scale({size / 2})"
    fill="#ffffff"
    stroke={palette.stroke}
    stroke-width={2 / size}
/>

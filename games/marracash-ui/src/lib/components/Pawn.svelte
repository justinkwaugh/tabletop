<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { MarketPalettes } from '$lib/utils/marketColors.js'

    let { color, x, y, size = 18 }: { color: MarketColor; x: number; y: number; size?: number } =
        $props()

    let palette = $derived(MarketPalettes[color])
    let scale = $derived(size / 18)
</script>

<g transform="translate({x} {y}) scale({scale})">
    <path
        d="M -7 9 Q -7 1 -3 -1 A 5 5 0 1 1 3 -1 Q 7 1 7 9 Z"
        fill={palette.fill}
        stroke={palette.stroke}
        stroke-width="1.5"
    />
</g>

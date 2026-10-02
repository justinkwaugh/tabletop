<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { MarketPalettes } from '$lib/utils/marketColors.js'

    let { color }: { color: MarketColor } = $props()

    let palette = $derived(MarketPalettes[color])
</script>

<path
    d="M -7 9 Q -7 1 -3 -1 A 5 5 0 1 1 3 -1 Q 7 1 7 9 Z"
    fill={palette.fill}
    stroke={palette.stroke}
    stroke-width="1.5"
></path>

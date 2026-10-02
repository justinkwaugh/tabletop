<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { color, x, y, size }: { color: MarketColor; x: number; y: number; size: number } =
        $props()
    const gameSession = getGameSession()

    let palette = $derived(gameSession.marketPalettes[color])
</script>

<circle cx={x} cy={y} r={size / 2} fill={palette.fill} stroke={palette.stroke} stroke-width="1"
></circle>

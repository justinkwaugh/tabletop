<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import MarketMark from '$lib/components/MarketMark.svelte'
    import PawnFigure from '$lib/components/PawnFigure.svelte'

    let { color, x, y, size }: { color: MarketColor; x: number; y: number; size: number } = $props()

    let scale = $derived(size / 18)
</script>

<g transform="translate({x} {y}) scale({scale})">
    <g transform="translate(-6 0)">
        <PawnFigure {color} />
    </g>
    <MarketMark {color} x={6} y={2} size={9} filled />
</g>

<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import PawnFigure from '$lib/components/PawnFigure.svelte'

    let {
        color,
        x,
        y,
        size = 18
    }: { color: MarketColor; x: number; y: number; size?: number } = $props()

    let scale = $derived(size / 18)
</script>

<g transform="translate({x} {y}) scale({scale})">
    <PawnFigure {color} />
</g>

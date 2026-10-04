<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import PawnFigure from '$lib/components/PawnFigure.svelte'
    import { PawnUnitSize } from '$lib/utils/pawnShape.js'

    let {
        color,
        x,
        y,
        size = PawnUnitSize,
        highlighted = false
    }: {
        color: MarketColor
        x: number
        y: number
        size?: number
        highlighted?: boolean
    } = $props()

    let scale = $derived(size / PawnUnitSize)
</script>

<g transform="translate({x} {y}) scale({scale})">
    <PawnFigure {color} {highlighted} />
</g>

<script lang="ts">
    import UnitSymbol from '$lib/components/UnitSymbol.svelte'
    import type { PrintedMark } from '$lib/map/boardGeometry.js'
    import { MARK_INK, MARK_PAPER, PENALISED_UNIT_TYPE } from '$lib/utils/approachSymbols.js'

    let { mark, width, height }: { mark: PrintedMark; width: number; height: number } = $props()

    const LINE_WIDTH = 1.2
    const BAR_THICKNESS = 2.6

    const penalised = $derived(PENALISED_UNIT_TYPE[mark])
    const diagonal = $derived(Math.hypot(width, height))
    const slant = $derived((Math.atan2(height, width) * 180) / Math.PI)
</script>

{#snippet diagonalBar(turn: number)}
    <rect
        transform="translate({width / 2} {height / 2}) rotate({turn})"
        x={-diagonal / 2}
        y={-BAR_THICKNESS / 2}
        width={diagonal}
        height={BAR_THICKNESS}
        fill={MARK_PAPER}
        stroke={MARK_INK}
        stroke-width={LINE_WIDTH}
    ></rect>
{/snippet}

{#if penalised !== undefined}
    <UnitSymbol
        type={penalised}
        {width}
        {height}
        ink={MARK_INK}
        lineWidth={LINE_WIDTH}
        dotRadius={height / 3}
        hollowDot
    />
{:else}
    {@render diagonalBar(-slant)}
    {#if mark === 'X'}
        {@render diagonalBar(slant)}
    {/if}
{/if}

<script lang="ts">
    import { Color } from '@tabletop/common'
    import { BoardShape, type PieceKind } from '@tabletop/matrx'
    import { viewOf } from '$lib/board/geometry.js'
    import { stackTop } from '$lib/board/pieceShape.js'
    import PieceShape from './PieceShape.svelte'

    // Stacks of pieces side by side, each its discs' kinds bottom to top, as they would stand on
    // the table: a tally beside a count on a player card, at the reserve's size.
    let { color, stacks }: { color: Color; stacks: PieceKind[][] } = $props()

    const view = viewOf(BoardShape.Matrx)
    const tone = $derived(color === Color.White ? 'light' : 'dark')

    const RADIUS = 13
    const GAP = 5
    const PITCH = RADIUS * 2 + GAP
    const tallest = $derived(Math.max(1, ...stacks.map((stack) => stack.length)))
    const top = $derived(-view.height(stackTop(tallest) * RADIUS) - RADIUS * view.tilt - 1)
    const bottom = RADIUS * view.tilt + 1
    const width = $derived(stacks.length * PITCH - GAP + 2)
</script>

{#if stacks.length > 0}
    <svg
        {width}
        height={bottom - top}
        viewBox="{-RADIUS - 1} {top} {width} {bottom - top}"
        class="shrink-0"
        aria-hidden="true"
    >
        {#each stacks as kinds, index (index)}
            <g transform="translate({index * PITCH} 0)">
                <PieceShape discs={kinds.map((kind) => ({ tone, kind }))} radius={RADIUS} {view} />
            </g>
        {/each}
    </svg>
{/if}

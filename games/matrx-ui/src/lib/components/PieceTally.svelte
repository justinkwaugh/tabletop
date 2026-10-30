<script lang="ts">
    import { Color } from '@tabletop/common'
    import { BoardShape, PieceKind } from '@tabletop/matrx'
    import { viewOf } from '$lib/board/geometry.js'
    import { stackTop } from '$lib/board/pieceShape.js'
    import PieceDefs from './PieceDefs.svelte'
    import PieceShape from './PieceShape.svelte'

    // Stacks of pieces side by side, each the given number of discs high, as they would stand on
    // the table: a tally beside a count on a player card.
    let {
        color,
        stacks,
        kind = PieceKind.Gipf
    }: { color: Color; stacks: number[]; kind?: PieceKind } = $props()

    const id = $props.id()
    const prefix = $derived(`matrx-tally-${id}`)
    const view = viewOf(BoardShape.Matrx)
    const tone = $derived(color === Color.White ? 'light' : 'dark')

    const RADIUS = 11
    const GAP = 5
    const PITCH = RADIUS * 2 + GAP
    const tallest = $derived(Math.max(1, ...stacks))
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
        <defs><PieceDefs {prefix} /></defs>
        {#each stacks as discs, index (index)}
            <g transform="translate({index * PITCH} 0)">
                <PieceShape
                    discs={Array.from({ length: discs }, () => ({ tone, kind }))}
                    radius={RADIUS}
                    {prefix}
                    {view}
                />
            </g>
        {/each}
    </svg>
{/if}

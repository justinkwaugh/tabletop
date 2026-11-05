<script lang="ts">
    import { Color } from '@tabletop/common'
    import { VIEW as view } from '$lib/board/geometry.js'
    import { stackTop, type DiscKind } from '$lib/board/pieceShape.js'
    import PieceShape from './PieceShape.svelte'

    // Stacks of pieces side by side, each its discs' marks bottom to top, as they would stand on
    // the table: a tally beside a count on a player card.
    let { color, stacks }: { color: Color; stacks: DiscKind[][] } = $props()

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

<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { VIEW } from '$lib/board/geometry.js'
    import { stackTop } from '$lib/board/pieceShape.js'
    import PieceDefs from './PieceDefs.svelte'
    import PieceShape from './PieceShape.svelte'

    // Stacks of pieces side by side, each the given number of discs high, as they would stand on
    // the table: a tally beside a count on a player card.
    let { color, stacks }: { color: Color; stacks: number[] } = $props()

    const id = $props.id()
    const prefix = $derived(`gipf-tally-${id}`)

    const RADIUS = 11
    const GAP = 5
    const PITCH = RADIUS * 2 + GAP
    const tallest = $derived(Math.max(1, ...stacks))
    const top = $derived(-VIEW.height(stackTop(tallest) * RADIUS) - RADIUS * VIEW.tilt - 1)
    const bottom = RADIUS * VIEW.tilt + 1
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
                <PieceShape {color} {discs} radius={RADIUS} {prefix} />
            </g>
        {/each}
    </svg>
{/if}

<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { Snippet } from 'svelte'
    import { pieceTurn } from './pieceTurn.js'

    /** A word or count of ours on a guild area, turned about `at` to read upright wherever the area stands. */
    let { at, children }: { at: Point; children: Snippet } = $props()

    const turn = pieceTurn()
</script>

{#if turn() === 0}
    {@render children()}
{:else}
    <g transform="rotate({turn()} {at.x} {at.y})" data-level>
        {@render children()}
    </g>
{/if}

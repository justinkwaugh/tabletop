<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { Snippet } from 'svelte'
    import { pieceTurn } from '$lib/components/guilds/pieceTurn.js'

    /** The inner node has no transform of its own, so an animation may own it. */
    let { at, piece, children }: { at: Point; piece: string; children: Snippet } = $props()

    const turn = pieceTurn()
</script>

<g transform="translate({at.x} {at.y})" data-world={piece}>
    <g data-motion={piece}>
        {#if turn() === 0}
            {@render children()}
        {:else}
            <g transform="rotate({turn()})">
                {@render children()}
            </g>
        {/if}
    </g>
</g>

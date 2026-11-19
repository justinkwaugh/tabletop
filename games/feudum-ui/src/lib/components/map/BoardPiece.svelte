<script lang="ts">
    import type { Snippet } from 'svelte'
    import { pieceTurn } from '$lib/components/guilds/pieceTurn.js'
    import type { Point } from '$lib/utils/boardGeometry.js'

    /**
     * A piece on the board: world placement on the outer node, and an inner node at the piece's
     * centre that has no transform of its own, which an animation may own. On a guild area stood
     * upright off the board, a node inside it turns the piece back about its centre (R-1.2.3).
     */
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

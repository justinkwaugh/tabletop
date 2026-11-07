<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Point } from '$lib/utils/boardGeometry.js'

    /**
     * A piece on the board: world placement on the outer node, and an inner node at the piece's
     * centre that has no transform of its own, which an animation may own.
     */
    let { at, piece, children }: { at: Point; piece: string; children: Snippet } = $props()
</script>

<g transform="translate({at.x} {at.y})" data-world={piece}>
    <g data-motion={piece}>
        {@render children()}
    </g>
</g>

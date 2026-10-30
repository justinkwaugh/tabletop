<script lang="ts">
    import { BoardShape } from '@tabletop/matrx'
    import { PIECE_RADIUS, viewOf } from '$lib/board/geometry.js'
    import { DISC_LOOKS, lookBox, lookName } from '$lib/board/pieceShape.js'
    import DiscLook from '$lib/components/DiscLook.svelte'
    import PieceDefs from '$lib/components/PieceDefs.svelte'

    // Every disc's look, each in an SVG of its own, for scripts/render-looks.mjs to save as files.
    const view = viewOf(BoardShape.Matrx)
    const box = lookBox(view, PIECE_RADIUS)
</script>

{#each DISC_LOOKS as disc (lookName(disc))}
    <svg
        xmlns="http://www.w3.org/2000/svg"
        data-look={lookName(disc)}
        viewBox="{box.x} {box.y} {box.width} {box.height}"
        width={box.width * 4}
        height={box.height * 4}
    >
        <defs><PieceDefs prefix="l" radius={PIECE_RADIUS} {view} looks={[]} /></defs>
        <DiscLook {disc} radius={PIECE_RADIUS} prefix="l" {view} />
    </svg>
{/each}

<script lang="ts">
    import { PIECE_RADIUS, VIEW as view } from '$lib/board/geometry.js'
    import { DISC_LOOKS, lookBox, lookName } from '$lib/board/pieceShape.js'
    import DiscLook from '$lib/components/DiscLook.svelte'
    import LookDefs from '$lib/components/LookDefs.svelte'

    // Every disc's look, each in an SVG of its own, for scripts/render-looks.mjs to save as files.
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
        <defs><LookDefs prefix="l" /></defs>
        <DiscLook {disc} radius={PIECE_RADIUS} prefix="l" {view} />
    </svg>
{/each}

<script lang="ts">
    import { PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import { lookBox, TONES } from '$lib/board/pieceShape.js'
    import DiscLook from '$lib/components/DiscLook.svelte'
    import LookDefs from '$lib/components/LookDefs.svelte'

    // Each tone's disc in an SVG of its own, for scripts/render-looks.mjs to save as files.
    const box = lookBox(VIEW, PIECE_RADIUS)
</script>

{#each TONES as tone (tone)}
    <svg
        xmlns="http://www.w3.org/2000/svg"
        data-look={tone}
        viewBox="{box.x} {box.y} {box.width} {box.height}"
        width={box.width * 4}
        height={box.height * 4}
    >
        <defs><LookDefs prefix="l" /></defs>
        <DiscLook {tone} radius={PIECE_RADIUS} prefix="l" view={VIEW} />
    </svg>
{/each}

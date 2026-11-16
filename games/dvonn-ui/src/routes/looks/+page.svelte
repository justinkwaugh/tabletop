<script lang="ts">
    import { PIECE_RADIUS } from '$lib/board/pieceGeometry.js'
    import { lookBox, lookName, LOOKS } from '$lib/board/pieceShape.js'
    import DiscLook from '$lib/components/DiscLook.svelte'
    import LookDefs from '$lib/components/LookDefs.svelte'

    // Every piece's look, each in an SVG of its own, for scripts/render-looks.mjs to save as files.
    const box = lookBox(PIECE_RADIUS)
</script>

{#each LOOKS as look (lookName(look))}
    <svg
        xmlns="http://www.w3.org/2000/svg"
        data-look={lookName(look)}
        viewBox="{box.x} {box.y} {box.width} {box.height}"
        width={box.width * 4}
        height={box.height * 4}
    >
        <defs>
            <LookDefs prefix="l" />
        </defs>
        <DiscLook {look} radius={PIECE_RADIUS} prefix="l" />
    </svg>
{/each}

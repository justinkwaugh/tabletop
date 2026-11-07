<svelte:options namespace="svg" />

<script lang="ts">
    import type { BoardView } from '$lib/board/geometry.js'
    import { RING_LOOK, ringBox } from '$lib/board/looks.js'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'

    // A ring about the centre of its hole at the rim. The looks page passes the image it has just
    // drawn.
    let { view, urls = LOOK_URLS }: { view: BoardView; urls?: Record<string, string> } = $props()

    const box = $derived(ringBox(view))
</script>

<image
    href={urls[RING_LOOK]}
    x={box.x}
    y={box.y}
    width={box.width}
    height={box.height}
    pointer-events="none"
></image>

<svelte:options namespace="svg" />

<script lang="ts">
    import type { BoardView } from '$lib/board/geometry.js'
    import { discSlices, topBands, type Tone } from '$lib/board/pieceShape.js'

    // One tone's disc, drawn in an SVG: the looks page draws each for scripts/render-looks.mjs to
    // save as an image. The gradients come from the LookDefs beside it.
    let {
        tone,
        radius,
        prefix,
        view
    }: { tone: Tone; radius: number; prefix: string; view: BoardView } = $props()

    const slices = $derived(discSlices(view, radius))
    const bands = $derived(topBands(view, radius, tone))
</script>

<g>
    {#each slices as slice, sliceIndex (sliceIndex)}
        <ellipse
            cy={slice.y}
            rx={slice.rx}
            ry={slice.ry}
            fill="url(#{prefix}-{tone}-side-{slice.level})"
        ></ellipse>
    {/each}
    {#each bands as band, bandIndex (bandIndex)}
        <ellipse cy={band.outer.y} rx={band.outer.rx} ry={band.outer.ry} fill={band.color}
        ></ellipse>
        {#if band.steep > 0}
            <ellipse
                cy={band.outer.y}
                rx={band.outer.rx}
                ry={band.outer.ry}
                fill="url(#{prefix}-{tone}-far-wall)"
                fill-opacity={band.steep}
            ></ellipse>
        {/if}
    {/each}
    {#each bands.toReversed() as band, bandIndex (bandIndex)}
        <path d={band.near} fill={band.color}></path>
        {#if band.steep > 0}
            <path d={band.near} fill="url(#{prefix}-{tone}-near-wall)" fill-opacity={band.steep}
            ></path>
        {/if}
    {/each}
</g>

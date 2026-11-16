<svelte:options namespace="svg" />

<script lang="ts">
    import { discSlices, topBands, type DishShading, type Look } from '$lib/board/pieceShape.js'

    // One piece's look, drawn in an SVG: the looks page draws each for scripts/render-looks.mjs
    // to save as an image. The gradients come from the LookDefs beside it. On a band's far half a
    // surface rising outward faces you, catching the light; on its near half it faces away, in
    // shade.
    let {
        look,
        radius,
        prefix,
        shading
    }: { look: Look; radius: number; prefix: string; shading?: DishShading } = $props()

    const slices = $derived(discSlices(radius))
    const bands = $derived(topBands(radius, look.tone, undefined, shading))
</script>

<g>
    {#each slices as slice, sliceIndex (sliceIndex)}
        <ellipse
            cy={slice.y}
            rx={slice.rx}
            ry={slice.ry}
            fill="url(#{prefix}-{look.tone}-side-{slice.level})"
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
                fill="url(#{prefix}-{look.tone}-far-{band.rising ? 'light' : 'shade'})"
                fill-opacity={band.steep}
            ></ellipse>
        {/if}
    {/each}
    {#each bands.toReversed() as band, bandIndex (bandIndex)}
        <path d={band.near} fill={band.color}></path>
        {#if band.steep > 0}
            <path
                d={band.near}
                fill="url(#{prefix}-{look.tone}-near-{band.rising ? 'shade' : 'light'})"
                fill-opacity={band.steep}
            ></path>
        {/if}
    {/each}
</g>

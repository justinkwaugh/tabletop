<svelte:options namespace="svg" />

<script lang="ts">
    import type { BoardView } from '$lib/board/geometry.js'
    import { discSlices, jokerSeed, topBands, type Look } from '$lib/board/pieceShape.js'
    import { sideSpeckPaths, topSpeckPaths } from '$lib/board/specks.js'

    // One disc's look, drawn in an SVG: the looks page draws each for scripts/render-looks.mjs to
    // save as an image. A joker's flecks are drawn in, kept on it by the clips of a PieceDefs
    // beside it; the gradients come from the LookDefs beside it.
    let {
        look,
        radius,
        prefix,
        view
    }: { look: Look; radius: number; prefix: string; view: BoardView } = $props()

    const color = $derived(look.color)
    const slices = $derived(discSlices(view, radius))
    const bands = $derived(topBands(view, radius, color))
    const drawn = $derived.by(() => {
        const joker = look.joker
        if (!joker) return undefined
        const seed = jokerSeed(joker.number)
        return {
            side: sideSpeckPaths(view, radius, color, seed, joker.turned),
            top: topSpeckPaths(view, radius, color, seed, joker.turned)
        }
    })
</script>

<g>
    {#each slices as slice, sliceIndex (sliceIndex)}
        <ellipse
            cy={slice.y}
            rx={slice.rx}
            ry={slice.ry}
            fill="url(#{prefix}-{color}-side-{slice.level})"
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
                fill="url(#{prefix}-{color}-far-wall)"
                fill-opacity={band.steep}
            ></ellipse>
        {/if}
    {/each}
    {#each bands.toReversed() as band, bandIndex (bandIndex)}
        <path d={band.near} fill={band.color}></path>
        {#if band.steep > 0}
            <path d={band.near} fill="url(#{prefix}-{color}-near-wall)" fill-opacity={band.steep}
            ></path>
        {/if}
    {/each}
    {#if drawn}
        <g clip-path="url(#{prefix}-side-clip)">
            {#each drawn.side as speck (speck.fill)}
                <path d={speck.d} fill={speck.fill} fill-opacity="0.9"></path>
            {/each}
        </g>
        <g clip-path="url(#{prefix}-top-clip)">
            {#each drawn.top as speck (speck.fill)}
                <path d={speck.d} fill={speck.fill} fill-opacity="0.9"></path>
            {/each}
        </g>
    {/if}
</g>

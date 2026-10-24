<svelte:options namespace="svg" />

<script lang="ts">
    import { Color } from '@tabletop/common'
    import { VIEW } from '$lib/board/geometry.js'
    import { pieceDrawing } from '$lib/board/pieceShape.js'

    // A piece standing on its point, seen from the near side of the table. The gradients come
    // from a PieceDefs with the same prefix in the same SVG.
    let {
        color,
        gipf,
        radius,
        prefix
    }: { color: Color; gipf: boolean; radius: number; prefix: string } = $props()

    const tone = $derived(color === Color.White ? 'light' : 'dark')
    const drawing = $derived(pieceDrawing(VIEW, gipf, radius))
</script>

{#each drawing.slices as slice, index (index)}
    <ellipse
        cy={slice.y}
        rx={slice.rx}
        ry={slice.ry}
        fill={slice.level < 0 ? undefined : `url(#${prefix}-${tone}-side-${slice.level})`}
        class:crease={slice.level < 0}
        class={tone}
    ></ellipse>
{/each}
<ellipse
    cy={drawing.top.y}
    rx={drawing.top.rx}
    ry={drawing.top.ry}
    fill="url(#{prefix}-{tone}-face)"
></ellipse>
<ellipse cy={drawing.trough.y} rx={drawing.trough.rx} ry={drawing.trough.ry} class="trough {tone}"
></ellipse>
<path d={drawing.farWall} class="far-wall {tone}"></path>
<path d={drawing.nearWall} class="near-wall {tone}"></path>
<ellipse
    cy={drawing.centre.y}
    rx={drawing.centre.rx}
    ry={drawing.centre.ry}
    fill="url(#{prefix}-{tone}-face)"
></ellipse>

<style>
    .crease.light {
        fill: #5e5644;
    }

    .crease.dark {
        fill: #000;
    }

    .trough.light {
        fill: #cfc6a6;
    }

    .far-wall.light {
        fill: #b4aa88;
    }

    .near-wall.light {
        fill: #ddd5b9;
    }

    .trough.dark {
        fill: #161415;
    }

    .far-wall.dark {
        fill: #0a0909;
    }

    .near-wall.dark {
        fill: #2b2829;
    }
</style>

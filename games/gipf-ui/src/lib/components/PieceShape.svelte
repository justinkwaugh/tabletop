<svelte:options namespace="svg" />

<script lang="ts">
    import { Color } from '@tabletop/common'
    import { VIEW } from '$lib/board/geometry.js'
    import { discsOf, pieceDrawing } from '$lib/board/pieceShape.js'
    import type { PieceParts } from '$lib/animators/drop.js'

    // A piece standing on its point, seen from the near side of the table, or any stack of discs
    // (discs, for a tally). The gradients come from a PieceDefs with the same prefix in the same
    // SVG. Each disc is drawn on its own node, centred on its base, so it can drop on its own.
    let {
        color,
        gipf = false,
        discs,
        radius,
        prefix,
        parts
    }: {
        color: Color
        gipf?: boolean
        discs?: number
        radius: number
        prefix: string
        parts?: PieceParts
    } = $props()

    const tone = $derived(color === Color.White ? 'light' : 'dark')
    const drawing = $derived(pieceDrawing(VIEW, discs ?? discsOf(gipf), radius))
    const disc = $derived(drawing.disc)
</script>

{#each drawing.bases as base, index (index)}
    <g transform="translate(0 {base})">
        <g {@attach parts?.disc(index)}>
            {#each disc.slices as slice, sliceIndex (sliceIndex)}
                <ellipse
                    cy={slice.y}
                    rx={slice.rx}
                    ry={slice.ry}
                    fill="url(#{prefix}-{tone}-side-{slice.level})"
                ></ellipse>
            {/each}
            <ellipse
                cy={disc.top.y}
                rx={disc.top.rx}
                ry={disc.top.ry}
                fill="url(#{prefix}-{tone}-face)"
            ></ellipse>
            <ellipse
                cy={disc.trough.y}
                rx={disc.trough.rx}
                ry={disc.trough.ry}
                class="trough {tone}"
            ></ellipse>
            <path d={disc.farWall} class="far-wall {tone}"></path>
            <path d={disc.nearWall} class="near-wall {tone}"></path>
            <ellipse
                cy={disc.centre.y}
                rx={disc.centre.rx}
                ry={disc.centre.ry}
                fill="url(#{prefix}-{tone}-face)"
            ></ellipse>
            {#if index < drawing.bases.length - 1}
                <g {@attach parts?.crease}>
                    <ellipse
                        cy={drawing.crease.y}
                        rx={drawing.crease.rx}
                        ry={drawing.crease.ry}
                        class="crease {tone}"
                    ></ellipse>
                </g>
            {/if}
        </g>
    </g>
{/each}

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

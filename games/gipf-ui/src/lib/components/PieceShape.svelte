<svelte:options namespace="svg" />

<script lang="ts">
    import { Color } from '@tabletop/common'
    import { VIEW } from '$lib/board/geometry.js'
    import { discsOf, lookBox, pieceDrawing } from '$lib/board/pieceShape.js'
    import { lookUrl } from '$lib/board/looks.js'
    import { liftOffCrease, liftOffDisc, type PieceParts } from '$lib/animators/drop.js'

    // A piece standing on its point, seen from the near side of the table, or any stack of discs
    // (discs, for a tally). Each disc is an image of its tone's look, pre-rendered by
    // scripts/render-looks.mjs, on its own node, centred on its base, so it can drop on its own.
    let {
        color,
        gipf = false,
        discs,
        radius,
        parts
    }: {
        color: Color
        gipf?: boolean
        discs?: number
        radius: number
        parts?: PieceParts
    } = $props()

    const tone = $derived(color === Color.White ? 'light' : 'dark')
    const drawing = $derived(pieceDrawing(VIEW, discs ?? discsOf(gipf), radius))
    const box = $derived(lookBox(VIEW, radius))
</script>

{#each drawing.bases as base, index (index)}
    <g transform="translate(0 {base})">
        <g {@attach parts?.disc(index)} out:liftOffDisc={{ parts }}>
            <image href={lookUrl(tone)} x={box.x} y={box.y} width={box.width} height={box.height}
            ></image>
            {#if index < drawing.bases.length - 1}
                <g {@attach parts?.crease} out:liftOffCrease={{ parts }}>
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
        fill: #8a8268;
    }

    .crease.dark {
        fill: #121011;
    }
</style>

<svelte:options namespace="svg" />

<script lang="ts">
    import type { BoardView } from '$lib/board/geometry.js'
    import { lookBox, pieceDrawing, type Disc } from '$lib/board/pieceShape.js'
    import { lookUrl } from '$lib/board/looks.js'
    import { liftOffCrease, liftOffDisc, type PieceParts } from '$lib/animators/drop.js'

    // A stack of discs standing on its point, seen from the near side of the table. Each disc is
    // an image of its look, pre-rendered by scripts/render-looks.mjs, on its own node, centred on
    // its base, so it can drop or lift off on its own.
    let {
        discs,
        radius,
        view,
        parts
    }: {
        discs: readonly Disc[]
        radius: number
        view: BoardView
        parts?: PieceParts
    } = $props()

    const drawing = $derived(pieceDrawing(view, discs.length, radius))
    const box = $derived(lookBox(view, radius))
</script>

{#each drawing.bases as base, index (index)}
    {@const tone = discs[index].tone}
    <g transform="translate(0 {base})">
        <g {@attach parts?.disc(index)} out:liftOffDisc={{ parts }}>
            <image
                href={lookUrl(discs[index])}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
            ></image>
            {#if index < drawing.bases.length - 1}
                <g {@attach parts?.crease(index)} out:liftOffCrease={{ parts }}>
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
</style>

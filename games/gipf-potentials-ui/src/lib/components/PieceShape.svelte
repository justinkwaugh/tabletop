<svelte:options namespace="svg" />

<script lang="ts">
    import type { BoardView } from '$lib/board/geometry.js'
    import { creaseOf, lookBox, pieceDrawing, type Disc } from '$lib/board/pieceShape.js'
    import { lookUrl } from '$lib/board/looks.js'
    import { liftOffCrease, liftOffDisc, type PieceParts } from '$lib/animators/drop.js'

    // GSAP drops a disc's inner node and Svelte lifts its wrapper off, so the two never write the
    // same transform.
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
        <g out:liftOffDisc={{ parts }}>
            <g {@attach parts?.disc(index)}>
                <image
                    href={lookUrl(discs[index])}
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                ></image>
                {#if index < drawing.bases.length - 1}
                    <g out:liftOffCrease={{ parts }}>
                        <g {@attach parts?.crease(index)}>
                            <path d={creaseOf(view, discs[index], radius)} class="crease {tone}"
                            ></path>
                        </g>
                    </g>
                {/if}
            </g>
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

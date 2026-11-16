<svelte:options namespace="svg" />

<script lang="ts">
    import { Color } from '@tabletop/common'
    import { VIEW } from '$lib/board/geometry.js'
    import { piecesIn } from '@tabletop/gipf'
    import { lookBox, pieceDrawing } from '$lib/board/pieceShape.js'
    import { lookUrl } from '$lib/board/looks.js'
    import { liftOffCrease, liftOffDisc, type PieceParts } from '$lib/animators/drop.js'

    // GSAP drops a disc's inner node and Svelte lifts its wrapper off, so the two never write the
    // same transform.
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
    const drawing = $derived(pieceDrawing(VIEW, discs ?? piecesIn(gipf), radius))
    const box = $derived(lookBox(VIEW, radius))
</script>

{#each drawing.bases as base, index (index)}
    <g transform="translate(0 {base})">
        <g out:liftOffDisc={{ parts }}>
            <g {@attach parts?.disc(index)}>
                <image
                    href={lookUrl(tone)}
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                ></image>
                {#if index < drawing.bases.length - 1}
                    <g out:liftOffCrease={{ parts }}>
                        <g {@attach parts?.crease}>
                            <ellipse
                                cy={drawing.crease.y}
                                rx={drawing.crease.rx}
                                ry={drawing.crease.ry}
                                class="crease {tone}"
                            ></ellipse>
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

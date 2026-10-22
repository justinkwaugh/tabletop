<script lang="ts">
    import { stackBounds, stackDiscs, sideHeight, TILT } from '$lib/board/pieceGeometry.js'

    // A plain stack of the given height, for counts that are about size rather than colors.
    let { height, size = 16 }: { height: number; size?: number } = $props()

    const RADIUS = 9
    const ry = RADIUS * TILT
    const side = sideHeight(RADIUS)
    const discs = $derived(stackDiscs(height, RADIUS))
    const tallest = stackBounds(5, RADIUS)
    const viewHeight = tallest.bottom - tallest.top + 2

    function sidePath(faceY: number): string {
        const r = RADIUS
        return `M ${-r} ${faceY} L ${-r} ${faceY + side} A ${r} ${ry} 0 0 0 ${r} ${faceY + side} L ${r} ${faceY} A ${r} ${ry} 0 0 1 ${-r} ${faceY} Z`
    }
</script>

<!-- Every height shares the frame of a stack of 5, so the icons stand on one baseline. -->
<svg
    width={size}
    height={(size * viewHeight) / (RADIUS * 2 + 2)}
    viewBox="{-RADIUS - 1} {tallest.top - 1} {RADIUS * 2 + 2} {viewHeight}"
    class="inline-block shrink-0"
    aria-hidden="true"
>
    {#each discs as disc, index (index)}
        <path d={sidePath(disc.faceY)} class="side"></path>
        <ellipse rx={RADIUS} {ry} cy={disc.faceY} class="face"></ellipse>
    {/each}
</svg>

<style>
    .side {
        fill: #6d7c93;
        stroke: #26303f;
        stroke-width: 0.9;
    }

    .face {
        fill: #a3b1c6;
        stroke: #26303f;
        stroke-width: 0.9;
    }
</style>

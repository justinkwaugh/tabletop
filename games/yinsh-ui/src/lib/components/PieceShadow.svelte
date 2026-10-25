<svelte:options namespace="svg" />

<script module lang="ts">
    export const SHADOW_SOFTNESS = 2.6
</script>

<script lang="ts">
    import { VIEW } from '$lib/board/geometry.js'
    import { MARKER_RADIUS, RING_OUTER } from '$lib/board/pieceGeometry.js'

    // A piece's shadow on the board, cast down and to the right, from a PieceDefs with the same
    // prefix in the same SVG.
    let { kind, prefix }: { kind: 'ring' | 'marker'; prefix: string } = $props()
</script>

<g transform="scale(1 {VIEW.tilt})">
    {#if kind === 'ring'}
        <circle cx="1.6" cy="1.6" r={RING_OUTER + SHADOW_SOFTNESS} fill="url(#{prefix}-shadow-ring)"
        ></circle>
    {:else}
        <circle
            cx="1.2"
            cy="1.2"
            r={MARKER_RADIUS + SHADOW_SOFTNESS}
            fill="url(#{prefix}-shadow-disc)"
        ></circle>
    {/if}
</g>

<script lang="ts">
    import { RING_OUTER, RING_SIDE } from '$lib/board/pieceGeometry.js'
    import type { Tone } from '$lib/board/pieceStyle.js'
    import RingShape from './RingShape.svelte'

    let {
        tone,
        seedKey,
        size,
        filled = true
    }: { tone: Tone; seedKey: string; size: number; filled?: boolean } = $props()

    const reach = RING_OUTER + 1
</script>

<svg
    width={size}
    height={size}
    viewBox="{-reach} {-reach} {reach * 2} {reach * 2 + RING_SIDE}"
    aria-hidden="true"
>
    {#if filled}
        <RingShape {tone} {seedKey} />
    {:else}
        <circle r={RING_OUTER} class="slot"></circle>
        <circle r={RING_OUTER * 0.66} class="slot"></circle>
    {/if}
</svg>

<style>
    .slot {
        fill: none;
        stroke: #7d93b4;
        stroke-width: 2.4;
        stroke-dasharray: 5 4;
    }
</style>

<script lang="ts">
    import { VIEW } from '$lib/board/geometry.js'
    import { RING_HEIGHT, RING_INNER, RING_OUTER } from '$lib/board/pieceGeometry.js'
    import type { Tone } from '$lib/board/pieceStyle.js'
    import PieceDefs from './PieceDefs.svelte'
    import RingShape from './RingShape.svelte'

    let {
        tone,
        seedKey,
        size,
        filled = true
    }: { tone: Tone; seedKey: string; size: number; filled?: boolean } = $props()

    const reach = RING_OUTER + 1
    const top = RING_OUTER * VIEW.tilt + VIEW.height(RING_HEIGHT) + 1
    const bottom = RING_OUTER * VIEW.tilt + 1
    const prefix = $derived(`ring-icon-${seedKey}`)
</script>

<svg
    width={size}
    height={(size * (top + bottom)) / (reach * 2)}
    viewBox="{-reach} {-top} {reach * 2} {top + bottom}"
    aria-hidden="true"
>
    {#if filled}
        <defs><PieceDefs {prefix} /></defs>
        <RingShape {tone} {seedKey} {prefix} />
    {:else}
        <ellipse rx={RING_OUTER} ry={RING_OUTER * VIEW.tilt} class="slot"></ellipse>
        <ellipse rx={RING_INNER} ry={RING_INNER * VIEW.tilt} class="slot"></ellipse>
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

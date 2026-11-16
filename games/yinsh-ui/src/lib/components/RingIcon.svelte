<script lang="ts">
    import { VIEW } from '$lib/board/geometry.js'
    import { RING_HEIGHT, RING_INNER, RING_OUTER } from '$lib/board/pieceGeometry.js'
    import { ellipsePath } from '$lib/board/pieceShape.js'
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
    // An empty space, painted like the board's own ring spaces with an edge to show on white.
    const SPACE = [RING_OUTER, RING_INNER]
        .map((r) => ellipsePath({ y: 0, rx: r, ry: r * VIEW.tilt }))
        .join(' ')
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
        <path d={SPACE} fill-rule="evenodd" class="space"></path>
    {/if}
</svg>

<style>
    .space {
        fill: var(--yinsh-play);
        stroke: var(--yinsh-play-edge);
        stroke-width: 1.2;
    }
</style>

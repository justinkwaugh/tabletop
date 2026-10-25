<script lang="ts">
    import type { PieceColor } from '@tabletop/lyngk'
    import StackShape from './StackShape.svelte'
    import PieceDefs from './PieceDefs.svelte'
    import { VIEW } from '$lib/board/geometry.js'
    import { stackBounds } from '$lib/board/pieceGeometry.js'

    // A stack drawn small. With `ring` set, room is kept for a ring lying on the ground around
    // its base, flattened as the board is, and the ring shows while `ring` is true.
    let {
        stack,
        size = 18,
        ring
    }: { stack: readonly PieceColor[]; size?: number; ring?: boolean } = $props()

    const uid = $props.id()
    const prefix = `lyngk-icon-${uid}`
    const RADIUS = 9
    // Room beyond the stack for its edge stroke, and below it for the shadow it casts.
    const MARGIN = 1
    const SHADOW = 2.5
    // The ring's radius, and the room kept beyond it for its strokes.
    const RING = RADIUS * 1.24
    const RING_ROOM = 1.6
    const bounds = $derived(stackBounds(VIEW, stack.length, RADIUS))
    const halfWidth = $derived(ring === undefined ? RADIUS + MARGIN : RING + RING_ROOM)
    const bottom = $derived(
        ring === undefined
            ? bounds.bottom + SHADOW
            : Math.max(bounds.bottom + SHADOW, RING * VIEW.tilt + RING_ROOM)
    )
    const top = $derived(bounds.top - MARGIN)
    // The stack keeps its size whether or not there is room for a ring.
    const scale = $derived(size / (RADIUS * 2 + 2 * MARGIN))
</script>

<svg
    width={halfWidth * 2 * scale}
    height={(bottom - top) * scale}
    viewBox="{-halfWidth} {top} {halfWidth * 2} {bottom - top}"
    class="inline-block shrink-0"
    aria-hidden="true"
    data-ground={-top / (bottom - top)}
    data-piece-fraction={(RADIUS + MARGIN) / halfWidth}
>
    <defs><PieceDefs {prefix} colors={stack} /></defs>
    {#if ring}
        <g class="ring">
            {#each ['under', 'over'] as layer (layer)}
                <ellipse
                    rx={RING}
                    ry={RING * VIEW.tilt}
                    class={layer}
                    vector-effect="non-scaling-stroke"
                ></ellipse>
            {/each}
        </g>
    {/if}
    <StackShape {stack} radius={RADIUS} {prefix} />
</svg>

<style>
    /* Cyan between thin dark edges, as the marks on the board are: 1px either side. */
    .ring ellipse {
        fill: none;
    }

    .ring .under {
        stroke: rgb(0 0 0 / 0.75);
        stroke-width: var(--ring-width-under, 4.5px);
    }

    .ring .over {
        stroke: var(--lyngk-mark);
        stroke-width: var(--ring-width, 2.5px);
    }
</style>

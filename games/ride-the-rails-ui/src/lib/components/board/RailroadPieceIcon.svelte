<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { CUBE_EDGE_WIDTH } from '$lib/utils/cubeShape.js'
    import RailroadPiece from './RailroadPiece.svelte'

    /** `size`: the cube's width in px; the icon leaves room round it for its edge. */
    let { railroadId, size = 20 }: { railroadId: RailroadId; size?: number } = $props()

    const box = $derived(size + 2 * CUBE_EDGE_WIDTH)
</script>

<svg
    class="inline-block shrink-0 align-middle"
    width={box}
    height={box}
    viewBox="{-box / 2} {-box / 2} {box} {box}"
    aria-hidden="true"
>
    <RailroadPiece {railroadId} x={0} y={0} width={size} />
</svg>

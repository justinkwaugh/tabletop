<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { CUBE_EDGE_WIDTH, cubeSquare } from '$lib/utils/cubeShape.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let {
        railroadId,
        x,
        y,
        width
    }: { railroadId: RailroadId; x: number; y: number; width: number } = $props()

    const square = $derived(cubeSquare(x, y, width))
</script>

<!-- Art plan, Cube: one flat rounded square in the railroad's colour with a dark edge. -->
<rect
    x={square.x}
    y={square.y}
    width={square.width}
    height={square.height}
    rx={square.rx}
    fill={railroadStyle(railroadId).fill}
    stroke="var(--rtr-cube-edge)"
    stroke-width={CUBE_EDGE_WIDTH}
    aria-hidden="true"
    data-cube={railroadId}
></rect>

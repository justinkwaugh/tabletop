<script lang="ts">
    import { cubeSquare } from '$lib/utils/cubeShape.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import type { GhostCube } from '$lib/utils/trackLayout.js'

    let { ghost }: { ghost: GhostCube } = $props()

    const style = $derived(railroadStyle(ghost.railroadId))
    const square = $derived(cubeSquare(ghost.x, ghost.y, ghost.width))
</script>

<!-- Art plan, Ghost cube (BOARD_LOOK.litRailroads 'ghost-cube'): the cube a railroad would place
     here, in the slot it would take: a pale square of its colour with a dashed edge in it. -->
<rect
    x={square.x}
    y={square.y}
    width={square.width}
    height={square.height}
    rx={square.rx}
    fill={style.ghost.fill}
    stroke={style.ghost.line}
    stroke-width="1.6"
    stroke-dasharray="3.6 2.2"
    aria-hidden="true"
    data-ghost={ghost.railroadId}
></rect>

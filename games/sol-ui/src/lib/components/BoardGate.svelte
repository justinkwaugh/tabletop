<script lang="ts">
    import GateIcon from '$lib/images/gate.svelte'
    import GateMask from '$lib/images/gateMask.svelte'
    import BoardSvg from './BoardSvg.svelte'
    import { getCirclePoint, toRadians, type GatePosition } from '$lib/utils/boardGeometry.js'
    import type { Point } from '@tabletop/common'

    let {
        color,
        width = 40,
        height = 39,
        position = { radius: 0, angle: 270 }
    }: {
        width?: number
        height?: number
        color: string
        location?: Point
        position?: GatePosition
    } = $props()
</script>

<BoardSvg {width} {height} location={getCirclePoint(position.radius, toRadians(position.angle))}>
    <!-- This transform logic translates so the bottom center is at the origin, rotates around it, then translates
     it back such that the bottom center is at the middle-->
    <g
        transform="translate({width / 2}, {height / 2}) rotate({90 +
            position.angle}) translate(-{width / 2}, -{height})"
    >
        <g transform="translate(-2, -2)">
            <GateMask
                width={width + 4}
                height={height + 4}
                fill={'black'}
                opacity=".5"
                overflow="visible"
                style="filter: url(#divershadow)"
            />
        </g>
        <GateIcon {width} {height} {color} />
    </g>
</BoardSvg>

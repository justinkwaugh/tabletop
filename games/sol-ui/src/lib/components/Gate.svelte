<script lang="ts">
    import GateIcon from '$lib/images/gate.svelte'
    import GateMask from '$lib/images/gateMask.svelte'
    import {
        getCirclePoint,
        toRadians,
        translateFromCenter,
        type GatePosition
    } from '$lib/utils/boardGeometry.js'
    import type { Point } from '@tabletop/common'

    let {
        color,
        location,
        position = { radius: 0, angle: 270 }
    }: { color: string; location?: Point; position: GatePosition } = $props()
    let renderedLocation = $derived(
        location ?? getCirclePoint(position.radius, toRadians(position.angle))
    )
</script>

<g
    transform="{translateFromCenter(renderedLocation.x, renderedLocation.y)} rotate({90 +
        position.angle}) scale(.35) translate(-57, -100) "
>
    <g transform="translate(-2, -2)">
        <GateMask
            width="118"
            height="104"
            fill={'black'}
            opacity=".5"
            overflow="visible"
            style="filter: url(#divershadow)"
        />
    </g>
    <GateIcon class={color} />
</g>

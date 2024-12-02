<script lang="ts">
    import GateIcon from '$lib/images/gate.svelte'
    import GateMask from '$lib/images/gateMask.svelte'
    import { getCirclePoint, toRadians, translateFromCenter } from '$lib/utils/boardGeometry.js'

    let { color, radius, angle }: { color: string; radius: number; angle: number } = $props()

    let location = $derived(getCirclePoint(radius, toRadians(angle)))
</script>

<g
    transform="{translateFromCenter(location.x, location.y)} rotate({90 +
        angle}) scale(.35) translate(-57, -100) "
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

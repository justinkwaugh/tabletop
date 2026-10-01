<script lang="ts">
    import type { RoadEnds } from '@tabletop/magna-grecia'
    import { localHexPoints, localRoadPath } from '$lib/utils/boardGeometry.js'

    let {
        ends,
        color,
        ghost = false
    }: { ends: RoadEnds; color: string; ghost?: boolean } = $props()

    const tileShape = localHexPoints(1.5)
    const path = $derived(localRoadPath(ends))
</script>

<g opacity={ghost ? 0.75 : 1}>
    <polygon
        points={tileShape}
        fill="#e2c275"
        stroke="#9c7a36"
        stroke-width="1.4"
        stroke-linejoin="round"
    ></polygon>
    <polygon points={tileShape} fill="url(#mg-land-shade)"></polygon>
    <path
        d={path}
        fill="none"
        stroke="#4d3016"
        stroke-width="16"
        stroke-linecap="butt"
        opacity="0.3"
    ></path>
    <path d={path} fill="none" stroke={color} stroke-width="12" stroke-linecap="butt"></path>
    <path
        d={path}
        fill="none"
        stroke="rgba(255, 244, 220, 0.55)"
        stroke-width="2.2"
        stroke-dasharray="2 5"
        stroke-linecap="round"
    ></path>
</g>

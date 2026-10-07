<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { BuildingStyle, BuildingType } from '@tabletop/urbino'
    import { BUILDING_FOOTPRINT, BUILDING_HEIGHT, shadowOffset } from '$lib/board/geometry.js'
    import BuildingShape from './BuildingShape.svelte'

    let {
        buildingType,
        color,
        buildingStyle,
        center,
        dimmed = false
    }: {
        buildingType: BuildingType
        color: string
        buildingStyle: BuildingStyle
        center: Point
        dimmed?: boolean
    } = $props()
</script>

<g transform="translate({center.x} {center.y})" class="transition-opacity duration-150" opacity={dimmed ? 0.35 : 1}>
    <BuildingShape
        {buildingType}
        {color}
        {buildingStyle}
        footprint={BUILDING_FOOTPRINT}
        shadow={{ offset: shadowOffset(BUILDING_HEIGHT[buildingType]), blurred: true }}
    />
</g>

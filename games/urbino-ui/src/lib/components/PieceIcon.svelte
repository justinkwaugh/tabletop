<script lang="ts">
    import type { BuildingStyle, BuildingType } from '@tabletop/urbino'
    import { BUILDING_HEIGHT } from '$lib/board/geometry.js'
    import BuildingShape from './BuildingShape.svelte'

    let {
        buildingType,
        color,
        buildingStyle,
        size = 22
    }: { buildingType: BuildingType; color: string; buildingStyle: BuildingStyle; size?: number } = $props()


    const footprint = $derived(size * 0.78)
    const shadowLength = $derived(size * 0.16 * BUILDING_HEIGHT[buildingType])
</script>

<svg
    width={size}
    height={size}
    viewBox="{-size / 2} {-size / 2} {size} {size}"
    class="shrink-0 overflow-visible"
    aria-hidden="true"
>
    <g transform="translate({-size * 0.08} {-size * 0.08})">
        <BuildingShape
            {buildingType}
            {color}
            {buildingStyle}
            {footprint}
            shadow={{ offset: { x: shadowLength, y: shadowLength * 0.8 }, blurred: false }}
        />
    </g>
</svg>

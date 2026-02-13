<script lang="ts">
    import { BuildingType, type BuildingSiteId } from '@tabletop/bus'
    import { BUS_BUILDING_SITE_POINTS } from '$lib/definitions/busBoardGraph.js'
    import HouseIcon from '$lib/images/HouseIcon.svelte'
    import OfficeIcon from '$lib/images/OfficeIcon.svelte'
    import PubIcon from '$lib/images/PubIcon.svelte'

    let {
        siteId,
        buildingType,
        scale = 1,
        opacity = 1
    }: {
        siteId: BuildingSiteId
        buildingType: BuildingType
        scale?: number
        opacity?: number
    } = $props()

    const BUILDING_ICON_SIZE = 50
    const BUILDING_ICON_BORDER_COLOR = '#333'
    const BUILDING_ICON_BORDER_WIDTH = 2
    const BUILDING_ICON_BORDER_RADIUS =
        BUILDING_ICON_SIZE / 2 - BUILDING_ICON_BORDER_WIDTH / 2

    const point = $derived(BUS_BUILDING_SITE_POINTS[siteId])
    const iconX = $derived(point.x - BUILDING_ICON_SIZE / 2)
    const iconY = $derived(point.y - BUILDING_ICON_SIZE / 2)
</script>

<g
    transform={`translate(${point.x} ${point.y}) scale(${scale}) translate(${-point.x} ${-point.y})`}
    opacity={opacity}
>
    {#if buildingType === BuildingType.House}
        <HouseIcon
            x={iconX}
            y={iconY}
            width={BUILDING_ICON_SIZE}
            height={BUILDING_ICON_SIZE}
            class="pointer-events-none"
            aria-hidden="true"
        />
    {:else if buildingType === BuildingType.Office}
        <OfficeIcon
            x={iconX}
            y={iconY}
            width={BUILDING_ICON_SIZE}
            height={BUILDING_ICON_SIZE}
            class="pointer-events-none"
            aria-hidden="true"
        />
    {:else}
        <PubIcon
            x={iconX}
            y={iconY}
            width={BUILDING_ICON_SIZE}
            height={BUILDING_ICON_SIZE}
            class="pointer-events-none"
            aria-hidden="true"
        />
    {/if}

    <circle
        cx={point.x}
        cy={point.y}
        r={BUILDING_ICON_BORDER_RADIUS}
        fill="none"
        stroke={BUILDING_ICON_BORDER_COLOR}
        stroke-width={BUILDING_ICON_BORDER_WIDTH}
        class="pointer-events-none"
        aria-hidden="true"
    ></circle>
</g>

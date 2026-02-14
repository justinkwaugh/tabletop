<script lang="ts">
    import { BuildingType } from '@tabletop/bus'
    import HouseIcon from '$lib/images/HouseIcon.svelte'
    import OfficeIcon from '$lib/images/OfficeIcon.svelte'
    import PubIcon from '$lib/images/PubIcon.svelte'

    let {
        buildingType
    }: {
        buildingType: BuildingType
    } = $props()

    const BUILDING_ICON_SIZE = 50
    const BUILDING_ICON_BORDER_COLOR = '#333'
    const BUILDING_ICON_BORDER_WIDTH = 2
    const BUILDING_ICON_BORDER_RADIUS = BUILDING_ICON_SIZE / 2 - BUILDING_ICON_BORDER_WIDTH / 2
    const LOCAL_ORIGIN_OFFSET = -BUILDING_ICON_SIZE / 2
</script>

<g transform={`translate(${LOCAL_ORIGIN_OFFSET} ${LOCAL_ORIGIN_OFFSET})`}>
    {#if buildingType === BuildingType.House}
        <HouseIcon
            x="0"
            y="0"
            width={BUILDING_ICON_SIZE}
            height={BUILDING_ICON_SIZE}
            class="pointer-events-none"
            aria-hidden="true"
        />
    {:else if buildingType === BuildingType.Office}
        <OfficeIcon
            x="0"
            y="0"
            width={BUILDING_ICON_SIZE}
            height={BUILDING_ICON_SIZE}
            class="pointer-events-none"
            aria-hidden="true"
        />
    {:else}
        <PubIcon
            x="0"
            y="0"
            width={BUILDING_ICON_SIZE}
            height={BUILDING_ICON_SIZE}
            class="pointer-events-none"
            aria-hidden="true"
        />
    {/if}

    <circle
        cx={BUILDING_ICON_SIZE / 2}
        cy={BUILDING_ICON_SIZE / 2}
        r={BUILDING_ICON_BORDER_RADIUS}
        fill="none"
        stroke={BUILDING_ICON_BORDER_COLOR}
        stroke-width={BUILDING_ICON_BORDER_WIDTH}
        class="pointer-events-none"
        aria-hidden="true"
    ></circle>
</g>

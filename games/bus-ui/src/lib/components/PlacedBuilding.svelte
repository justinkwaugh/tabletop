<script lang="ts">
    import { BuildingType, type BuildingSiteId } from '@tabletop/bus'
    import { BUS_BUILDING_SITE_POINTS } from '$lib/definitions/busBoardGraph.js'
    import HouseIcon from '$lib/images/HouseIcon.svelte'
    import OfficeIcon from '$lib/images/OfficeIcon.svelte'
    import PubIcon from '$lib/images/PubIcon.svelte'

    let {
        siteId,
        buildingType
    }: {
        siteId: BuildingSiteId
        buildingType: BuildingType
    } = $props()

    const BUILDING_ICON_SIZE = 48

    const point = $derived(BUS_BUILDING_SITE_POINTS[siteId])
    const iconX = $derived(point.x - BUILDING_ICON_SIZE / 2)
    const iconY = $derived(point.y - BUILDING_ICON_SIZE / 2)
</script>

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

<script lang="ts">
    import type { ActionAllowanceKind } from '$lib/utils/actionAllowances.js'
    import CityTileIcon from './CityTileIcon.svelte'
    import ResupplyIcon from './ResupplyIcon.svelte'
    import RoadIcon from './RoadIcon.svelte'

    let { kind, size }: { kind: ActionAllowanceKind; size: number } = $props()
</script>

{#if kind === 'roads'}
    <RoadIcon {size} />
{:else if kind === 'cities'}
    <CityTileIcon {size} />
{:else}
    <ResupplyIcon {size} />
{/if}

<script lang="ts">
    import { RESOURCES, type ResourceAmounts } from '@tabletop/power-grid'
    import ResourceToken from '../ResourceToken.svelte'

    let { amounts }: { amounts: ResourceAmounts } = $props()
</script>

<span class="tally">
    {#each RESOURCES.filter((resource) => amounts[resource] > 0) as resource (resource)}
        <span class="item">
            {amounts[resource]}
            <svg class="chip" width="18" height="18" viewBox="-9 -9 18 18" aria-label={resource}>
                <ResourceToken {resource} size={14} />
            </svg>
        </span>
    {/each}
</span>

<style>
    .tally {
        display: inline-flex;
        gap: 8px;
        vertical-align: middle;
    }
    .chip {
        background: #cbc4ab;
        border-radius: 3px;
    }
    .item {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-weight: 700;
    }
</style>

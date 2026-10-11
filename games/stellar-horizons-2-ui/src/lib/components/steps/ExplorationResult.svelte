<script lang="ts">
    import { isExplore, shipDefinition, type Explore } from '@tabletop/stellar-horizons-2'
    import type { GameAction } from '@tabletop/common'
    import { systemName } from '$lib/utils/presentation.js'
    import TechMarker from '../TechMarker.svelte'

    let { action }: { action: GameAction } = $props()
    const explore: Explore | undefined = $derived(isExplore(action) ? action : undefined)
    const result = $derived(explore?.metadata)
</script>

{#if explore && result}
    <div class="result">
        <span class="title"
            >{shipDefinition(explore.shipId).name} at {systemName(result.systemId)}:</span
        >
        {#each result.markers as value, index (index)}
            <TechMarker field={result.field} {value} size={26} />
        {:else}
            {#if !result.cash}<span>no markers</span>{/if}
        {/each}
        {#if result.cash}<span>${result.cash}B (pool empty)</span>{/if}
        {#if result.survey}<span class="good">enough for a survey</span>{/if}
        {#if result.destroyed}
            <span class="bad">malfunction ({result.malfunctionRoll}%): ship lost</span>
        {:else if result.damage > 0}
            <span class="bad">malfunction ({result.malfunctionRoll}%): {result.damage} damage</span>
        {/if}
    </div>
{/if}

<style>
    .result {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #b7c7de;
    }

    .title {
        color: #e8f1ff;
    }

    .good {
        color: #7fe08a;
    }

    .bad {
        color: #ff8a7a;
    }
</style>

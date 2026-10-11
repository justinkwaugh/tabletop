<script lang="ts">
    // PROTOTYPE: escalation markers as their square tiles; penalties red, benefits dark.
    import type { MockFaction } from './campaignMock.svelte.js'
    import Coin from './Coin.svelte'

    let { faction, detail = false }: { faction: MockFaction; detail?: boolean } = $props()
    const penalties = $derived(
        faction.escalation.filter((marker) => marker.text && !marker.benefit)
    )
    const points = $derived(
        faction.escalation.reduce((total, marker) => total + (marker.vp ?? 0), 0)
    )
</script>

{#if detail}
    <div class="tiles">
        {#each faction.escalation as marker, index (index)}
            <span class="tile" class:penalty={marker.text && !marker.benefit}>
                {#if marker.vp}<Coin value={marker.vp} size={20} />{:else}{marker.text}{/if}
            </span>
        {:else}
            <span class="none">No escalation markers</span>
        {/each}
    </div>
{:else if faction.escalation.length > 0}
    <span
        class="summary"
        title={faction.escalation.map((marker) => marker.text ?? `${marker.vp} points`).join('; ')}
    >
        <span class="mark">{faction.escalation.length}</span>
        {#if penalties.length > 0}<span class="bad">{penalties.length} against</span>{/if}
        {#if points > 0}<span class="good">+{points}</span>{/if}
    </span>
{/if}

<style>
    .tiles {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    .tile {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 30px;
        max-width: 96px;
        padding: 3px 6px;
        border-radius: 4px;
        background: #1b1430;
        border: 1px solid #3a2f5c;
        color: #e9e3f7;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.15;
        text-align: center;
    }
    .tile.penalty {
        background: #4a1220;
        border-color: #8a2a3a;
        color: #ffd9d6;
    }
    .none {
        font-size: 12.5px;
        color: #8fa4c2;
    }
    .summary {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12.5px;
    }
    .mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 3px;
        background: #4a1220;
        border: 1px solid #8a2a3a;
        color: #ffd9d6;
        font-weight: 800;
    }
    .bad {
        color: #ff8a7a;
    }
    .good {
        color: #f2c94c;
    }
</style>

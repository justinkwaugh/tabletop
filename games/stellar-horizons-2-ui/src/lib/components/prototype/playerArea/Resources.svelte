<script lang="ts">
    // PROTOTYPE: the things a player spends: cash, influence and tech markers.
    import { TECH_FIELDS } from '@tabletop/stellar-horizons-2'
    import TechMarkerTotal from '$lib/components/TechMarkerTotal.svelte'
    import type { MockFaction } from './campaignMock.svelte.js'
    import Coin from './Coin.svelte'

    let {
        faction,
        marker = 26,
        score = false
    }: { faction: MockFaction; marker?: number; score?: boolean } = $props()
</script>

<div class="resources">
    <span class="cash" title="Cash">${faction.cash}B</span>
    <span class="ip" title="Influence points">{faction.ip}<small>IP</small></span>
    <span class="markers">
        {#each TECH_FIELDS as field (field)}
            <TechMarkerTotal {field} values={faction.markers[field]} size={marker} />
        {/each}
    </span>
    {#if score}
        <span class="score"><Coin value={faction.score} size={marker} /></span>
    {/if}
</div>

<style>
    .resources {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .cash {
        font-size: 17px;
        font-weight: 800;
        color: #f2c94c;
    }
    .ip {
        font-size: 17px;
        font-weight: 800;
        color: #e88fc9;
    }
    .ip small {
        margin-left: 2px;
        font-size: 11px;
        font-weight: 700;
    }
    .markers {
        display: inline-flex;
        gap: 3px;
    }
    .score {
        margin-left: auto;
    }
</style>

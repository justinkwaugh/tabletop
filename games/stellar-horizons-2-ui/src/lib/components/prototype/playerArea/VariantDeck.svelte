<script lang="ts">
    // PROTOTYPE (variant C): slim rows here; the chosen faction's full sheet sits under the map.
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { FACTION_FILL, factionName } from '$lib/utils/presentation.js'
    import { MOCK_FACTIONS, playerArea } from './campaignMock.svelte.js'
    import Bases from './Bases.svelte'
    import Fleet from './Fleet.svelte'
    import Resources from './Resources.svelte'

    function choose(faction: (typeof MOCK_FACTIONS)[number]) {
        playerArea.selected = faction.faction
        playerArea.sheetOpen = true
    }
</script>

<div class="rows">
    {#each MOCK_FACTIONS as faction (faction.faction)}
        <button
            type="button"
            class="row"
            class:selected={playerArea.selected === faction.faction}
            style:--faction={FACTION_FILL[faction.faction]}
            onclick={() => choose(faction)}
        >
            <span class="top">
                <span class="init">{faction.initiative}</span>
                <img src={FACTION_ART[faction.faction]} alt="" width="22" height="22" />
                <span class="name">{faction.you ? 'You' : faction.player}</span>
                <span class="faction">{factionName(faction.faction)}</span>
                <span class="step" class:done={faction.step === 'Done'}>{faction.step}</span>
            </span>
            <Resources {faction} marker={24} score />
            <span class="pieces">
                <Fleet {faction} size={19} />
                <Bases {faction} height={17} />
            </span>
        </button>
    {/each}
</div>

<style>
    .rows {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .row {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid #1e2b44;
        background: #0d1322;
        color: #dbe7f5;
        text-align: left;
    }
    .row.selected {
        border-color: var(--faction);
        background: color-mix(in srgb, var(--faction) 22%, #0d1322);
    }
    .top {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .top img {
        border-radius: 3px;
    }
    .init {
        width: 12px;
        font-size: 13px;
        font-weight: 800;
        color: #8fa4c2;
    }
    .name {
        font-size: 14px;
        font-weight: 800;
    }
    .faction {
        flex: 1;
        min-width: 0;
        font-size: 12px;
        color: #9fb4d0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .step {
        font-size: 12px;
        color: #b7c7de;
    }
    .step.done {
        color: #7fe08a;
    }
    .pieces {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
</style>

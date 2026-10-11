<script lang="ts">
    // PROTOTYPE (variant A): a standings list for everyone, and one console for the chosen faction.
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { FACTION_FILL, factionName } from '$lib/utils/presentation.js'
    import { MOCK_FACTIONS, playerArea } from './campaignMock.svelte.js'
    import Coin from './Coin.svelte'
    import Console from './Console.svelte'
</script>

<div class="ledger">
    <div class="standings">
        {#each MOCK_FACTIONS as faction (faction.faction)}
            <button
                type="button"
                class="row"
                class:selected={playerArea.selected === faction.faction}
                style:--faction={FACTION_FILL[faction.faction]}
                onclick={() => (playerArea.selected = faction.faction)}
                title={factionName(faction.faction)}
            >
                <span class="init">{faction.initiative}</span>
                <img src={FACTION_ART[faction.faction]} alt="" width="24" height="24" />
                <span class="who">
                    <span class="name">{faction.player}</span>
                    <span class="step" class:done={faction.step === 'Done'}>{faction.step}</span>
                </span>
                <span class="cash">${faction.cash}B</span>
                <span class="ip">{faction.ip}<small>IP</small></span>
                <Coin value={faction.score} size={24} />
            </button>
        {/each}
    </div>
    <Console faction={playerArea.selectedFaction} />
</div>

<style>
    .ledger {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .standings {
        display: flex;
        flex-direction: column;
        border: 1px solid #1e2b44;
        border-radius: 8px;
        overflow: hidden;
        background: #0d1322;
    }
    .row {
        display: grid;
        grid-template-columns: 14px 24px 1fr auto 40px 24px;
        align-items: center;
        gap: 7px;
        padding: 4px 8px;
        text-align: left;
        color: #dbe7f5;
        border-top: 1px solid #1a2438;
    }
    .row:first-child {
        border-top: none;
    }
    .row.selected {
        background: color-mix(in srgb, var(--faction) 32%, #0d1322);
    }
    .row img {
        border-radius: 3px;
    }
    .init {
        font-size: 13px;
        font-weight: 800;
        color: #8fa4c2;
        text-align: center;
    }
    .who {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.15;
    }
    .name {
        font-size: 14px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .step {
        font-size: 11.5px;
        color: #9fb4d0;
    }
    .step.done {
        color: #7fe08a;
    }
    .cash {
        font-size: 14px;
        font-weight: 800;
        color: #f2c94c;
        text-align: right;
    }
    .ip {
        font-size: 14px;
        font-weight: 800;
        color: #e88fc9;
        text-align: right;
    }
    .ip small {
        margin-left: 1px;
        font-size: 10px;
    }
</style>

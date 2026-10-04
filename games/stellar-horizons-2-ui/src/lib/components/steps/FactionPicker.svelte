<script lang="ts">
    import { Faction, HydratedChooseFaction } from '@tabletop/stellar-horizons-2'
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FACTION_BLURB, FACTION_FILL, factionName } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const available = $derived(HydratedChooseFaction.availableFactions(gameSession.gameState))
</script>

<div class="picker">
    <p class="prompt">
        Choose your faction. In this scenario factions differ only in their ships; their special
        abilities are not used.
    </p>
    <div class="grid">
        {#each available as faction (faction)}
            <button
                type="button"
                class="faction"
                style:--faction={FACTION_FILL[faction]}
                onclick={() => gameSession.chooseFaction(faction)}
            >
                <img src={FACTION_ART[faction]} alt="" width="48" height="48" />
                <span class="name">{factionName(faction)}</span>
                <span class="blurb">{FACTION_BLURB[faction]}</span>
                {#if faction === Faction.Consortium}
                    <span class="note"
                        >Not recommended: its early cargo ships unbalance this scenario.</span
                    >
                {/if}
            </button>
        {/each}
    </div>
</div>

<style>
    .picker {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .prompt {
        color: #9fb4d0;
        font-size: 14px;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 8px;
    }

    .faction {
        display: grid;
        grid-template-columns: 48px 1fr;
        grid-template-rows: auto auto auto;
        column-gap: 8px;
        text-align: left;
        padding: 8px;
        border-radius: 10px;
        border: 2px solid var(--faction);
        background: #121c30;
    }

    .faction:hover {
        background: #1a2742;
    }

    .faction img {
        grid-row: 1 / span 3;
    }

    .name {
        font-weight: 700;
        color: #e8f1ff;
    }

    .blurb {
        font-size: 12px;
        color: #9fb4d0;
    }

    .note {
        font-size: 11px;
        color: #f2c94c;
    }
</style>

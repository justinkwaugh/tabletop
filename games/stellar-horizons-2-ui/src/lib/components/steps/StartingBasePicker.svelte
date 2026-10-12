<script lang="ts">
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { factionName, systemName } from '$lib/utils/presentation.js'
    import { startingBaseOptions } from '$lib/utils/startingBases.js'
    import WorldImage from '../WorldImage.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const options = $derived(startingBaseOptions(gameState))
    const settlements = $derived(gameState.scenarioDefinition().startingBase?.settlements ?? 0)
</script>

<div class="sh-step">
    <p class="hint">
        Choose where your base of {settlements} settlements starts. Ships can be built there and reach
        two systems out from it.
    </p>
    <div class="grid">
        {#each options as option (option.systemId)}
            <button
                type="button"
                class="option"
                onclick={() => gameSession.placeStartingBase(option.systemId)}
            >
                <span class="name">{systemName(option.systemId)}</span>
                <span class="worlds">
                    {#each option.worlds as world, slot (slot)}
                        <WorldImage tileId={world.tileId} side={world.side} size={52} />
                    {/each}
                </span>
                <span class="facts"
                    >Population {option.population} · habitability {option.habitability}%</span
                >
                <span class="neighbours">
                    {#each option.neighbours as faction (faction)}
                        <img
                            src={FACTION_ART[faction]}
                            alt={factionName(faction)}
                            title="{factionName(faction)} start here"
                            width="22"
                            height="22"
                        />
                    {:else}
                        Nobody here yet
                    {/each}
                </span>
            </button>
        {/each}
    </div>
</div>

<style>
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 8px;
    }

    .option {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        text-align: left;
        border-radius: 10px;
        border: 1px solid #2a3b5c;
        background: #121c30;
    }

    .option:hover {
        background: #1a2742;
    }

    .name {
        font-weight: 700;
        color: #e8f1ff;
    }

    .worlds {
        display: flex;
        gap: 6px;
        min-height: 52px;
    }

    .facts,
    .neighbours {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 22px;
        font-size: 12px;
        color: #9fb4d0;
    }
</style>

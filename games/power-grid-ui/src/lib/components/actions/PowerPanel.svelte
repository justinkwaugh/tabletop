<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlantCard from '../PlantCard.svelte'
    import Stepper from './Stepper.svelte'
    import Elektro from './Elektro.svelte'
    import ResourceTally from './ResourceTally.svelte'

    const session = getGameSession()
    const preview = $derived(session.powerPreview)
    const plants = $derived(session.myPlayerState?.plants ?? [])
    const cityCount = $derived(
        session.myPlayerId ? session.gameState.cityCount(session.myPlayerId) : 0
    )
</script>

{#if preview}
    <div class="column">
        <p class="prompt">
            Choose which plants to run. You have {cityCount}
            {cityCount === 1 ? 'city' : 'cities'} in your network.
        </p>
        <div class="controls">
            {#each plants as plant (plant)}
                {@const on = preview.plants.includes(plant)}
                <div class="plant">
                    <PlantCard
                        {plant}
                        size={60}
                        selected={on}
                        dimmed={!on}
                        targetable={!on && session.canRun(plant)}
                        onclick={on || session.canRun(plant)
                            ? () => session.togglePowerPlant(plant)
                            : undefined}
                    />
                    <span class="state"
                        >{on ? 'Running' : session.canRun(plant) ? 'Idle' : 'No fuel'}</span
                    >
                </div>
            {/each}
            {#if session.hybridNeed > 0}
                <div class="hybrid">
                    <span class="note">Coal in hybrids</span>
                    <Stepper
                        label="Coal burned in hybrid plants"
                        value={preview.hybridCoal}
                        min={0}
                        max={session.hybridNeed}
                        onchange={(value) => session.setHybridCoal(value)}
                    />
                </div>
            {/if}
            <div class="summary">
                {#if preview.valid}
                    <span>Burns <ResourceTally amounts={preview.fuel} /></span>
                {:else}
                    <span class="warning">Not enough fuel for that mix.</span>
                {/if}
            </div>
            <button
                type="button"
                class="btn primary"
                disabled={!preview.valid}
                onclick={() => session.powerCities()}
            >
                Power {preview.powered}
                {preview.powered === 1 ? 'city' : 'cities'}: earn <Elektro
                    amount={preview.earned}
                />
            </button>
        </div>
    </div>
{/if}

<style>
    .plant {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }
    .state {
        font-size: 13px;
        color: #cfd4bd;
    }
    .hybrid {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .warning {
        color: #f08a6c;
    }
</style>

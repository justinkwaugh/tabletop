<script lang="ts">
    import { WorldSide, maxPopulation, surveySwapSlots } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import WorldImage from '../WorldImage.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const choice = $derived(gameState.surveyChoice)
    // Planetary Surveys draw two worlds; each may be swapped in for a smaller world.
    const swaps = $derived(
        choice && !choice.fillsSlot
            ? choice.drawnTileIds.flatMap((tileId) =>
                  surveySwapSlots(gameState, choice.systemId, tileId).map((slot) => ({
                      tileId,
                      slot
                  }))
              )
            : []
    )
</script>

{#if choice}
    <div class="sh-step">
        {#if choice.fillsSlot}
            <p class="hint">
                Your survey of {systemName(choice.systemId)} drew {choice.drawnTileIds.length} worlds
                with Planetary Surveys. Choose the one to place; the other goes back to the pool.
            </p>
            <div class="row">
                {#each choice.drawnTileIds as tileId (tileId)}
                    <button
                        type="button"
                        class="swap"
                        onclick={() => gameSession.chooseSurveyWorld(tileId, undefined)}
                    >
                        <WorldImage {tileId} size={80} />
                        <span>Place this (population {maxPopulation(tileId, WorldSide.I)})</span>
                    </button>
                {/each}
            </div>
        {:else}
            <p class="hint">
                Your survey of {systemName(choice.systemId)} found
                {choice.drawnTileIds.length > 1 ? 'worlds' : 'a world'} of population
                {choice.drawnTileIds
                    .map((tileId) => maxPopulation(tileId, WorldSide.I))
                    .join(' and ')}. You may swap one in for a smaller world.
            </p>
            <div class="row">
                {#each choice.drawnTileIds as tileId (tileId)}
                    <div class="drawn">
                        <WorldImage {tileId} size={80} />
                        <span>Found</span>
                    </div>
                {/each}
                {#each swaps as swap (`${swap.tileId}:${swap.slot}`)}
                    {@const world = gameState.systemState(choice.systemId).worlds[swap.slot]}
                    <button
                        type="button"
                        class="swap"
                        onclick={() => gameSession.chooseSurveyWorld(swap.tileId, swap.slot)}
                    >
                        <WorldImage tileId={world.tileId} side={world.side} size={64} />
                        <span
                            >Replace this{choice.drawnTileIds.length > 1
                                ? ` with ${maxPopulation(swap.tileId, WorldSide.I)}`
                                : ''}</span
                        >
                    </button>
                {/each}
                <button
                    type="button"
                    onclick={() => gameSession.chooseSurveyWorld(undefined, undefined)}
                    >Keep current worlds</button
                >
            </div>
        {/if}
    </div>
{/if}

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
    }

    .drawn,
    .swap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        font-size: 12px;
    }
</style>

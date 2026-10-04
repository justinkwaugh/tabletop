<script lang="ts">
    import { WorldSide, maxPopulation, surveySwapSlots } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import WorldImage from '../WorldImage.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const choice = $derived(gameState.surveyChoice)
    const slots = $derived(
        choice ? surveySwapSlots(gameState, choice.systemId, choice.drawnTileId) : []
    )
</script>

{#if choice}
    <div class="sh-step">
        <p class="hint">
            Your survey of {systemName(choice.systemId)} found a world of population
            {maxPopulation(choice.drawnTileId, WorldSide.I)}. You may swap it in for a smaller
            world.
        </p>
        <div class="row">
            <div class="drawn">
                <WorldImage tileId={choice.drawnTileId} size={80} />
                <span>Found</span>
            </div>
            {#each slots as slot (slot)}
                {@const world = gameState.systemState(choice.systemId).worlds[slot]}
                <button
                    type="button"
                    class="swap"
                    onclick={() => gameSession.chooseSurveyWorld(slot)}
                >
                    <WorldImage tileId={world.tileId} side={world.side} size={64} />
                    <span>Replace this</span>
                </button>
            {/each}
            <button type="button" onclick={() => gameSession.chooseSurveyWorld(undefined)}
                >Keep current worlds</button
            >
        </div>
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

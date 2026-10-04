<script lang="ts">
    import { removalOptions, replacementOptions } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import WorldImage from '../WorldImage.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const choice = $derived(gameState.terraformChoice)
    const replacements = $derived(choice ? replacementOptions(gameState, choice) : [])
    const removable = $derived(choice ? removalOptions(gameState, choice) : [])

    let replacement: string | undefined = $state()
    let removed: string[] = $state([])

    const chosenReplacement = $derived(
        replacement && replacements.includes(replacement) ? replacement : undefined
    )
    const chosenRemovals = $derived(
        removed.filter((tileId) => tileId !== chosenReplacement && removable.includes(tileId))
    )

    function toggleRemoval(tileId: string) {
        removed = removed.includes(tileId)
            ? removed.filter((candidate) => candidate !== tileId)
            : [...removed, tileId]
    }

    async function confirm() {
        const tileId = chosenReplacement
        const removedTileIds = chosenRemovals
        replacement = undefined
        removed = []
        await gameSession.chooseTerraformWorld(tileId, removedTileIds)
    }
</script>

{#if choice}
    {@const current = gameState.systemState(choice.systemId).worlds[choice.slot]}
    <div class="sh-step">
        <p class="hint">
            Terraforming at {systemName(choice.systemId)}. Choose a drawn world to replace the
            current one, and optionally remove smaller draws from the game.
        </p>
        <div class="row">
            <div class="world">
                <WorldImage tileId={current.tileId} side={current.side} size={72} />
                <span>Current</span>
            </div>
            {#each choice.drawnTileIds as tileId (tileId)}
                <div class="world" class:chosen={chosenReplacement === tileId}>
                    <WorldImage {tileId} size={72} />
                    {#if replacements.includes(tileId)}
                        <button
                            type="button"
                            onclick={() =>
                                (replacement = chosenReplacement === tileId ? undefined : tileId)}
                            >{chosenReplacement === tileId ? 'Replacing' : 'Use this world'}</button
                        >
                    {/if}
                    {#if removable.includes(tileId)}
                        <label>
                            <input
                                type="checkbox"
                                checked={chosenRemovals.includes(tileId)}
                                onchange={() => toggleRemoval(tileId)}
                            />
                            Remove from game
                        </label>
                    {/if}
                </div>
            {/each}
        </div>
        <div class="buttons">
            <button type="button" class="primary" onclick={confirm}>Confirm</button>
        </div>
    </div>
{/if}

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: flex-start;
    }

    .world {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        padding: 4px;
        border-radius: 8px;
        border: 2px solid transparent;
    }

    .world.chosen {
        border-color: #ffd65a;
    }
</style>

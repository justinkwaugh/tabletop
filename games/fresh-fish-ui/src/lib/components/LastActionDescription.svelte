<script lang="ts">
    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'
    import { GameSessionMode } from '@tabletop/frontend-components'
    import PlayerName from './PlayerName.svelte'
    import { Button } from 'flowbite-svelte'

    let gameSession = getContext('gameSession') as FreshFishGameSession

    let lastAction = $derived.by(() => {
        let action
        if (gameSession.mode === GameSessionMode.History && gameSession.currentHistoryIndex >= 0) {
            action = gameSession.actions[gameSession.currentHistoryIndex]
        } else if (gameSession.mode === GameSessionMode.Play) {
            action = gameSession.actions[gameSession.actions.length - 1]
        }
        return action
    })
</script>

{#if lastAction}
    <div
        class="rounded-lg bg-transparent text-gray-200 p-2 text-center flex flex-row flex-wrap justify-center items-center mb-2"
    >
        <div class="flex flex-col justify-center items-center mx-8">
            <h1 class="text-lg">
                {#if lastAction && lastAction.playerId}
                    <PlayerName playerId={lastAction.playerId} />
                {/if}
                {getDescriptionForAction(lastAction)}
            </h1>
        </div>

        {#if gameSession.undoableAction && gameSession.mode !== GameSessionMode.History}
            <Button
                onclick={async () => {
                    await gameSession.undo()
                }}
                size="xs"
                class="h-[28px]"
                color="light">Undo</Button
            >
        {/if}
    </div>
{/if}

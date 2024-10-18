<script lang="ts">
    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'
    import { GameSessionMode, PlayerName } from '@tabletop/frontend-components'
    import { Button } from 'flowbite-svelte'
    import AuctionResults from './AuctionResults.svelte'
    import { isEndAuction, isPlaceBid } from '@tabletop/fresh-fish'

    let gameSession = getContext('gameSession') as FreshFishGameSession

    let windowHeight: number | null | undefined = $state()

    let lastAction = $derived.by(() => {
        let action
        if (gameSession.mode === GameSessionMode.History && gameSession.currentHistoryIndex >= 0) {
            action = gameSession.actions[gameSession.currentHistoryIndex]
        } else if (gameSession.mode === GameSessionMode.Play) {
            let actionIndex = gameSession.actions.length - 1
            do {
                action = gameSession.actions[actionIndex]
                actionIndex -= 1
            } while (actionIndex > 0 && action && isPlaceBid(action))
        }
        return action
    })
</script>

<svelte:window bind:innerHeight={windowHeight} />

{#if lastAction}
    <div
        class="rounded-lg bg-transparent text-gray-200 p-1 sm:p-2 text-center flex flex-row justify-center items-center mb-2"
    >
        <div class="flex flex-col justify-center items-center w-full grow-1">
            {#if isEndAuction(lastAction)}
                <AuctionResults winnerOnly={(windowHeight ?? 0) <= 700} action={lastAction} />
            {:else}
                <h1 class="text-sm sm:text-lg text-pretty leading-tight">
                    {#if lastAction && lastAction.playerId}
                        <PlayerName playerId={lastAction.playerId} />
                    {/if}
                    {getDescriptionForAction(lastAction)}
                </h1>
            {/if}
        </div>

        {#if gameSession.undoableAction && gameSession.mode !== GameSessionMode.History}
            <Button
                onclick={async () => {
                    gameSession.chosenAction = undefined
                    await gameSession.undo()
                }}
                size="xs"
                class="h-[24px] sm:h-[28px] grow-0 ms-2"
                color="light">Undo</Button
            >
        {/if}
    </div>
{/if}

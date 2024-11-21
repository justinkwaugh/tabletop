<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'
    import { GameSessionMode, PlayerName } from '@tabletop/frontend-components'
    import { Button } from 'flowbite-svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    let windowHeight: number | null | undefined = $state()
</script>

<svelte:window bind:innerHeight={windowHeight} />

{#if gameSession.currentAction}
    <div
        class="rounded-lg bg-transparent text-gray-200 p-1 sm:p-2 text-center flex flex-row justify-center items-center mb-2"
    >
        <div class="flex flex-col justify-center items-center w-full grow-1">
            <h1 class="text-sm sm:text-lg text-pretty leading-tight">
                {#if gameSession.currentAction.playerId}
                    <PlayerName playerId={gameSession.currentAction.playerId} />
                {/if}
                {getDescriptionForAction(gameSession.currentAction)}
            </h1>
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

<script lang="ts">
    import { getContext } from 'svelte'
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { MachineState } from '@tabletop/bridges-of-shangri-la'

    let gameSession = getContext('gameSession') as BridgesGameSession

    const currentPlayerId = $derived(
        gameSession.gameState.activePlayerIds.length === 1
            ? gameSession.gameState.activePlayerIds[0]
            : undefined
    )

    const waitingText = $derived.by(() => {
        if (gameSession.gameState.machineState === MachineState.RecruitingStudents) {
            return 'to recruit a second student...'
        }

        return 'to take their turn...'
    })
</script>

<div
    class="mb-2 rounded-lg bg-gray-300 p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-4">
        <h1 class="text-lg">
            Waiting for <span
                class="rounded px-2 {gameSession.getPlayerBgColor(
                    currentPlayerId
                )} font-medium {gameSession.getPlayerTextColor(currentPlayerId)}"
                >{gameSession.getPlayerName(currentPlayerId)}</span
            >
            {waitingText}
        </h1>

        {#if gameSession.undoableAction}
            <Button
                onclick={async () => {
                    await gameSession.undo()
                }}
                size="xs"
                class="mt-4"
                color="light"
                >Undo {gameSession.nameForActionType(gameSession.undoableAction.type)}</Button
            >
        {/if}
    </div>
</div>

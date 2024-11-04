<script lang="ts">
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { GameSessionMode } from '@tabletop/frontend-components'
    import { Button } from 'flowbite-svelte'
    import ActionDescription from '$lib/components/ActionDescription.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

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

<div
    class="rounded-lg bg-gray-300 text-[#111111] py-1 px-2 text-center flex flex-row justify-center items-center mb-2 min-h-[42px]"
>
    <div class="flex flex-col justify-center items-center mx-8">
        <h1 class="text-lg text-pretty leading-tight">
            {#if !lastAction}
                The game has been started!
            {:else}
                <ActionDescription action={lastAction} />
            {/if}
        </h1>
    </div>

    {#if gameSession.undoableAction && gameSession.mode !== GameSessionMode.History}
        <Button
            onclick={async () => {
                gameSession.chosenAction = undefined
                await gameSession.undo()
            }}
            size="xs"
            class="h-[28px]"
            color="light">Undo</Button
        >
    {/if}
</div>

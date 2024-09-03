<script lang="ts">
    import { Button } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import { ActionType, PlaceBid } from '@tabletop/kaivai'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import BidBoard from './BidBoard.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let showCancel = $derived.by(() => {
        return false
    })
    let showActions = $derived(!gameSession.chosenAction)

    function chooseAction(action: string) {
        switch (action) {
            default:
                gameSession.chosenAction = action
                break
        }
    }

    const instructions = $derived.by(() => {
        if (!gameSession.chosenAction) {
            return 'Choose an action'
        }

        switch (gameSession.chosenAction) {
            case ActionType.PlaceBid:
                return 'Place your bid'
            default:
                return ''
        }
    })

    $effect(() => {
        if (gameSession.validActionTypes.length === 1) {
            const singleAction = gameSession.validActionTypes[0]
            chooseAction(singleAction)
        } else if (gameSession.validActionTypes.length === 0) {
            gameSession.resetAction()
        }
    })
</script>

<div
    class="mb-2 rounded-lg bg-transparent p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-8">
        <h1 class="text-lg">{instructions}</h1>

        <div class="flex flex-row justify-center items-center">
            {#if showCancel}
                <Button onclick={() => gameSession.cancel()} size="xs" class="m-1" color="red"
                    >Cancel</Button
                >
            {/if}
            {#if showActions}
                {#each gameSession.validActionTypes as action}
                    <Button onclick={() => chooseAction(action)} size="xs" class="m-1" color="blue"
                        >{action}</Button
                    >
                {/each}
            {/if}

            {#if gameSession.undoableAction}
                <Button
                    onclick={async () => {
                        gameSession.resetAction()
                        await gameSession.undo()
                    }}
                    size="xs"
                    class="m-1"
                    color="light">Undo</Button
                >
            {/if}
        </div>
    </div>
</div>

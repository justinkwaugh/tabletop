<script lang="ts">
    import { getContext } from 'svelte'
    import { ActionType } from '@tabletop/estates'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { AuctionRecipient, MachineState } from '@tabletop/estates'
    import { Button } from 'flowbite-svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    async function chooseAction(action: string) {
        switch (action) {
            default:
                gameSession.chosenAction = action
                break
        }
    }

    const instructions = $derived.by(() => {
        if (gameSession.gameState.machineState === MachineState.StartOfTurn) {
            return 'Choose a piece to auction'
        } else if (gameSession.gameState.machineState === MachineState.AuctionEnded) {
            return 'Buy out the winner?'
        }

        switch (gameSession.chosenAction) {
            case ActionType.PlaceBid:
                return 'Place your bid'
            case ActionType.PlaceCube:
                return 'Place your cube on the board'
            case ActionType.PlaceMayor:
                return 'Place the mayor'
            case ActionType.PlaceRoof:
                return 'Place your roof on the board'
            case ActionType.PlaceBarrier:
                return 'Place your barrier on the board'
            case ActionType.RemoveBarrier:
                return 'Choose a barrier to remove'
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

    async function chooseRecipient(recipient: AuctionRecipient) {
        await gameSession.chooseRecipient(recipient)
    }
</script>

{#if gameSession.gameState.machineState !== MachineState.Auctioning}
    <div
        class="mb-2 rounded-lg bg-gray-300 p-2 text-center flex flex-row flex-wrap justify-center items-center"
    >
        <div class="flex flex-col justify-center items-center mx-8">
            <h1 class="text-lg">{instructions}</h1>
            {#if gameSession.gameState.machineState === MachineState.AuctionEnded}
                <div class="flex flex-row justify-center gap-x-2 items-center mt-2 mb-2">
                    <Button onclick={() => chooseRecipient(AuctionRecipient.Auctioneer)} size="xs"
                        >Yes</Button
                    >
                    <Button
                        onclick={() => chooseRecipient(AuctionRecipient.HighestBidder)}
                        size="xs">No</Button
                    >
                </div>
            {/if}
        </div>
    </div>
{/if}

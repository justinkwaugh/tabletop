<script lang="ts">
    import { getContext } from 'svelte'
    import { ActionType } from '@tabletop/estates'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { AuctionRecipient, MachineState } from '@tabletop/estates'
    import { Button } from 'flowbite-svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession
    let bidValue = $state(0)

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

    function incrementBid() {
        bidValue = Math.min(bidValue + 1, gameSession.myPlayerState?.money ?? 0)
    }

    function decrementBid() {
        bidValue = Math.max(bidValue - 1, gameSession.gameState.auction?.highBid ?? 0 + 1)
    }

    async function placeBid() {
        await gameSession.placeBid(bidValue)
    }

    async function chooseRecipient(recipient: AuctionRecipient) {
        await gameSession.chooseRecipient(recipient)
    }
</script>

<div
    class="mb-2 rounded-lg bg-gray-300 p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-8">
        <h1 class="text-lg">{instructions}</h1>
        {#if gameSession.chosenAction === ActionType.PlaceBid}
            <div class="flex flex-row justify-center items-center mt-2 mb-3">
                <button
                    class="flex flex-col justify-center items-center rounded-full w-[35px] h-[35px] bg-gray-400"
                    onclick={decrementBid}><h1 class="text-2xl">-</h1></button
                >
                <h1 class="w-[50px] text-4xl">{bidValue}</h1>
                <button
                    class="flex flex-col justify-center items-center rounded-full w-[35px] h-[35px] bg-gray-400"
                    onclick={incrementBid}><h1 class="text-2xl">+</h1></button
                >
            </div>
            <Button onclick={() => placeBid()} size="xs">Submit</Button>
        {/if}
        {#if gameSession.gameState.machineState === MachineState.AuctionEnded}
            <div class="flex flex-row justify-center gap-x-2 items-center mt-2 mb-2">
                <Button onclick={() => chooseRecipient(AuctionRecipient.HighestBidder)} size="xs"
                    >Yes</Button
                >
                <Button onclick={() => chooseRecipient(AuctionRecipient.Auctioneer)} size="xs"
                    >No</Button
                >
            </div>
        {/if}
    </div>
</div>

<script lang="ts">
    import { Button } from 'flowbite-svelte'
    import { ActionType } from '@tabletop/fresh-fish'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import StallTile from '$lib/components/StallTile.svelte'
    import MarketTile from '$lib/components/MarketTile.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as FreshFishGameSession
    let bidValue = $state(0)
    let playerState = $derived.by(() =>
        gameSession.gameState.players.find((p) => p.playerId === gameSession.myPlayer?.id)
    )

    let windowHeight: number | null | undefined = $state()

    async function chooseAction(action: string) {
        switch (action) {
            case ActionType.DrawTile:
                const drawTileAction = gameSession.createDrawTileAction()
                await gameSession.applyAction(drawTileAction)
                break
            default:
                gameSession.chosenAction = action
                break
        }
    }

    async function placeBid() {
        const placeBidAction = gameSession.createPlaceBidAction(bidValue)
        await gameSession.applyAction(placeBidAction)
        bidValue = 0
    }

    let showCancel = $derived(
        gameSession.chosenAction &&
            gameSession.chosenAction === ActionType.PlaceDisk &&
            gameSession.validActionTypes.length > 1
    )

    let showActions = $derived(!gameSession.chosenAction)

    function cancelAction() {
        gameSession.chosenAction = undefined
    }

    const instructions = $derived.by(() => {
        if (!gameSession.chosenAction) {
            return 'Choose an action'
        }

        switch (gameSession.chosenAction) {
            case ActionType.PlaceBid:
                return 'Place your bid'
            case ActionType.PlaceDisk:
                return 'Please place your disk'
            case ActionType.PlaceStall:
                return 'Please place your stall on the board'
            case ActionType.PlaceMarket:
                return 'Please place the market on the board'
            default:
                return ''
        }
    })

    function incrementBid() {
        bidValue = Math.min(bidValue + 1, playerState?.money ?? 0)
    }

    function decrementBid() {
        bidValue = Math.max(bidValue - 1, 0)
    }

    $effect(() => {
        if (gameSession.isMyTurn && gameSession.validActionTypes.length === 1) {
            const singleAction = gameSession.validActionTypes[0]
            // Don't force a draw tile as that reveals info and makes the prior player unable to quickly undo
            if (singleAction !== ActionType.DrawTile) {
                chooseAction(gameSession.validActionTypes[0]).catch((error) => {
                    console.error('Error choosing action:', error)
                })
            }
        }
    })
</script>

<svelte:window bind:innerHeight={windowHeight} />

<div class="mb-2 rounded-lg bg-gray-300 p-2 text-center flex flex-row justify-center items-center">
    {#if gameSession.chosenAction === ActionType.PlaceBid}
        <StallTile
            size={windowHeight && windowHeight > 700 ? 90 : 80}
            goodsType={gameSession.gameState.getChosenStallType()}
        />
    {/if}
    {#if gameSession.chosenAction === ActionType.PlaceStall}
        <StallTile
            size={windowHeight && windowHeight > 700 ? 80 : 50}
            goodsType={gameSession.gameState.getChosenStallType()}
        />
    {/if}
    {#if gameSession.chosenAction === ActionType.PlaceMarket}
        <MarketTile size={windowHeight && windowHeight > 700 ? 80 : 50} animate={false} />
    {/if}
    <div class="flex flex-col justify-center items-center mx-8">
        <h1 class="text:md sm:text-lg leading-tight">{instructions}</h1>
        {#if gameSession.chosenAction === ActionType.PlaceBid}
            <div class="flex flex-row justify-center items-center my-0 sm:my-1 md:my-2">
                <button
                    class="flex flex-col justify-center items-center rounded-full w-[30px] sm:w-[35px] h-[30px] sm:h-[35px] bg-gray-400"
                    onclick={decrementBid}><h1 class="text-2xl mb-1">-</h1></button
                >
                <h1 class="w-[50px] text-3xl sm:text-4xl">{bidValue}</h1>
                <button
                    class="flex flex-col justify-center items-center rounded-full w-[30px] sm:w-[35px] h-[30px] sm:h-[35px] bg-gray-400"
                    onclick={incrementBid}><h1 class="text-2xl mb-1">+</h1></button
                >
            </div>
        {/if}
        <div class="flex flex-row justify-center items-center">
            {#if showCancel}
                <Button onclick={() => cancelAction()} size="xs" class="m-1" color="red"
                    >Cancel</Button
                >
            {/if}
            {#if showActions}
                {#each gameSession.validActionTypes as action}
                    <Button
                        onclick={async () => chooseAction(action)}
                        size="xs"
                        class="m-1"
                        color="blue">{gameSession.nameForActionType(action)}</Button
                    >
                {/each}
            {/if}
            {#if gameSession.chosenAction === ActionType.PlaceBid}
                <Button onclick={async () => placeBid()} size="xs" class="m-1" color="blue"
                    >Bid ${bidValue}</Button
                >
            {/if}
        </div>
    </div>
</div>

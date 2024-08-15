<script lang="ts">
    import { Button, Range } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import { ActionType } from '@tabletop/fresh-fish'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import StallTile from '$lib/components/StallTile.svelte'
    import MarketTile from '$lib/components/MarketTile.svelte'
    import { fade } from 'svelte/transition'

    let gameSession = getContext('gameSession') as FreshFishGameSession
    let bidValue = $state(0)
    let playerState = $derived.by(() =>
        gameSession.hydratedState.players.find((p) => p.playerId === gameSession.myPlayer?.id)
    )

    function nameForActionType(actionType: string) {
        switch (actionType) {
            case ActionType.DrawTile:
                return 'Draw Tile'
            case ActionType.PlaceBid:
                return 'Place Bid'
            case ActionType.PlaceDisk:
                return 'Place Disk'
            default:
                return actionType
        }
    }

    function chooseAction(action: string) {
        switch (action) {
            case ActionType.DrawTile:
                const drawTileAction = gameSession.createDrawTileAction()
                gameSession.applyAction(drawTileAction)
                cancelAction()
                break
            default:
                gameSession.chosenAction = action
                break
        }
    }

    function placeBid() {
        const placeBidAction = gameSession.createPlaceBidAction(bidValue)
        gameSession.applyAction(placeBidAction)
        cancelAction()
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
                return 'Choose your bid amount'
            case ActionType.PlaceDisk:
                return 'Please place a disk on the board'
            case ActionType.PlaceStall:
                return 'Please place the stall on the board'
            case ActionType.PlaceMarket:
                return 'Please place the market on the board'
            default:
                return ''
        }
    })

    $effect(() => {
        if (gameSession.validActionTypes.length === 1) {
            const singleAction = gameSession.validActionTypes[0]
            // Don't force a draw tile as that reveals info and makes the prior player unable to quickly undo
            if (singleAction !== ActionType.DrawTile) {
                chooseAction(gameSession.validActionTypes[0])
            }
        }
    })
</script>

<div
    class="mb-2 rounded-lg bg-gray-300 p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    {#if gameSession.chosenAction === ActionType.PlaceBid}
        <StallTile
            size={90}
            playerColor={''}
            goodsType={gameSession.hydratedState.getChosenStallType()}
        />
    {/if}
    <div class="flex flex-col justify-center items-center mx-4">
        <h1 class="text-lg">{instructions}</h1>
        {#if gameSession.chosenAction === ActionType.PlaceBid}
            <div class="flex flex-row justify-center items-center">
                <div>0</div>
                <Range
                    class="m-2 w-[200px]"
                    id="range-steps"
                    min="0"
                    max={playerState?.money ?? 0}
                    bind:value={bidValue}
                    step="1"
                />
                <div>{playerState?.money ?? 0}</div>
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
                    <Button onclick={() => chooseAction(action)} size="xs" class="m-1" color="blue"
                        >{nameForActionType(action)}</Button
                    >
                {/each}
            {/if}
            {#if gameSession.chosenAction === ActionType.PlaceBid}
                <Button onclick={() => placeBid()} size="xs" class="m-1" color="blue"
                    >Bid ${bidValue}</Button
                >
            {/if}
            {#if gameSession.chosenAction === ActionType.PlaceStall}
                <div class="my-2">
                    <StallTile
                        playerColor={playerState?.color ?? ''}
                        goodsType={gameSession.hydratedState.getChosenStallType()}
                    />
                </div>
            {/if}
            {#if gameSession.chosenAction === ActionType.PlaceMarket}
                <div class="my-2">
                    <MarketTile />
                </div>
            {/if}
        </div>
    </div>
</div>

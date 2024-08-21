<script lang="ts">
    import { getContext } from 'svelte'
    import { isMarketTile, isStallTile } from '@tabletop/fresh-fish'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import { fade } from 'svelte/transition'
    import { MachineState } from '@tabletop/fresh-fish'
    import { Button } from 'flowbite-svelte'

    let gameSession = getContext('gameSession') as FreshFishGameSession

    let isAuctioning = $derived.by(() => {
        return gameSession.gameState.machineState === MachineState.AuctioningTile
    })

    let isStallPlacement = $derived(isStallTile(gameSession.gameState.chosenTile))
    let isMarketPlacement = $derived(isMarketTile(gameSession.gameState.chosenTile))
    let stallName = $derived.by(() => {
        const chosenTile = gameSession.gameState.chosenTile
        if (isStallTile(chosenTile)) {
            return gameSession.getGoodsName(chosenTile.goodsType)
        }
        return ''
    })

    const currentPlayerId = $derived(
        gameSession.gameState.activePlayerIds.length === 1
            ? gameSession.gameState.activePlayerIds[0]
            : undefined
    )
</script>

<div
    class="mb-2 rounded-lg bg-gray-300 p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-4">
        {#if isAuctioning}
            <h1 class="text-lg">Collecting other players' bids...</h1>
            <div class="flex flex-row justify-center items-center">
                {#each gameSession.gameState.activePlayerIds as playerId}
                    <div class="flex flex-col justify-center items-center mx-2">
                        <h1 class="text-lg">
                            <span
                                class="rounded px-2 {gameSession.getPlayerBgColor(
                                    playerId
                                )} font-medium {gameSession.getPlayerTextColor(playerId)}"
                                >{gameSession.getPlayerName(playerId)}</span
                            >
                        </h1>
                    </div>
                {/each}
            </div>
        {:else if isMarketPlacement}
            <h1 class="text-lg">
                Waiting for <span
                    class="rounded px-2 {gameSession.getPlayerBgColor(
                        currentPlayerId
                    )} font-medium {gameSession.getPlayerTextColor(currentPlayerId)}"
                    >{gameSession.getPlayerName(currentPlayerId)}</span
                > to place their market tile...
            </h1>
        {:else if isStallPlacement}
            <h1 class="text-lg">
                Waiting for <span
                    class="rounded px-2 {gameSession.getPlayerBgColor(
                        currentPlayerId
                    )} font-medium {gameSession.getPlayerTextColor(currentPlayerId)}"
                    >{gameSession.getPlayerName(currentPlayerId)}</span
                >
                to place their {stallName} stall tile...
            </h1>
        {:else}
            <h1 class="text-lg">
                Waiting for <span
                    class="rounded px-2 {gameSession.getPlayerBgColor(
                        currentPlayerId
                    )} font-medium {gameSession.getPlayerTextColor(currentPlayerId)}"
                    >{gameSession.getPlayerName(currentPlayerId)}</span
                > to take their turn...
            </h1>
        {/if}
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

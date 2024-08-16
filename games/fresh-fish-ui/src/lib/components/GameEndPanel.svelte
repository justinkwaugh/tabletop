<script lang="ts">
    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import { GameResult } from '@tabletop/common'
    import { fade } from 'svelte/transition'
    import { Scorer } from '@tabletop/fresh-fish'

    let gameSession = getContext('gameSession') as FreshFishGameSession

    const maxDistance = $derived(
        Scorer.MAXIMUM_DISTANCE_BY_PLAYER_COUNT[gameSession.game.players.length]
    )

    let isWin = $derived(gameSession.gameState.result === GameResult.Win)
    let winner = $derived(isWin ? gameSession.gameState.winningPlayerIds[0] : undefined)
</script>

<div
    transition:fade={{ duration: 75 }}
    class="mb-2 rounded-lg bg-gray-300 px-2 pt-2 pb-4 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-4 w-full">
        <h1 class="text-3xl mb-2">Game Over</h1>

        <div class="flex flex-row justify-center items-center mb-2">
            {#if isWin}
                <h1 class="text-md sm:text-lg">
                    <span
                        class="rounded px-2 {gameSession.getPlayerBgColor(
                            winner
                        )} font-medium {gameSession.getPlayerTextColor(winner)}"
                        >{gameSession.getPlayerName(winner)}</span
                    >
                    wins with a score of {gameSession.hydratedState.getPlayerState(
                        winner ?? 'anyone'
                    )?.score}
                </h1>
            {:else}
                <h1 class="text-lg">
                    {#each gameSession.gameState.winningPlayerIds as winner, i}
                        {#if i > 0}
                            and
                        {/if}
                        <span
                            class="rounded px-2 {gameSession.getPlayerBgColor(
                                winner
                            )} font-medium {gameSession.getPlayerTextColor(winner)}"
                            >{gameSession.getPlayerName(winner)}</span
                        >
                    {/each} tied with a score of {gameSession.hydratedState.getPlayerState(
                        gameSession.gameState.winningPlayerIds[0]
                    )?.score}
                </h1>
            {/if}
        </div>
        <div class="flex w-full shrink overflow-scroll">
            <div class="flex flex-row m-auto">
                {#each gameSession.gameState.players as player}
                    <div
                        class="mt-2 mx-1 min-w-[140px] rounded-lg {gameSession.getPlayerBgColor(
                            player.playerId
                        )} py-[3px] px-4 text-center {gameSession.getPlayerTextColor(
                            player.playerId
                        )} font-medium flex flex-col justify-center"
                    >
                        <h1 class="text-lg font-medium mb-1">
                            {gameSession.getPlayerName(player.playerId)}
                        </h1>
                        <div class="text-sm flex flex-col justify-center items-start w-full">
                            {#each player.stalls as stall}
                                <div class="flex flex-row justify-between items-center w-full">
                                    <div class="mr-8">
                                        {gameSession.getGoodsName(stall.goodsType)}
                                    </div>
                                    <div>
                                        -{stall.distance
                                            ? Math.min(maxDistance, stall.distance)
                                            : maxDistance}
                                    </div>
                                </div>
                            {/each}
                            <div class="flex flex-row justify-between items-center w-full">
                                <div>money</div>
                                <div>{player.money}</div>
                            </div>

                            <div
                                class="flex flex-row justify-between items-center w-full mt-3 mb-2"
                            >
                                <div>total</div>
                                <div>{player.score}</div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

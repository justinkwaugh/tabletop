<script lang="ts">
    import { getContext } from 'svelte'
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'
    import { GameResult } from '@tabletop/common'
    import { fade } from 'svelte/transition'

    let gameSession = getContext('gameSession') as BridgesGameSession
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
                    wins with a score of {gameSession.gameState.getPlayerState(winner ?? 'anyone')
                        ?.score}
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
                    {/each} tied with a score of {gameSession.gameState.getPlayerState(
                        gameSession.gameState.winningPlayerIds[0]
                    )?.score}
                </h1>
            {/if}
        </div>
    </div>
</div>

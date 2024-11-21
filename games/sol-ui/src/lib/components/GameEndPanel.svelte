<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { GameResult } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'

    let gameSession = getContext('gameSession') as SolGameSession
    let isWin = $derived(gameSession.gameState.result === GameResult.Win)
    let winner = $derived(isWin ? gameSession.gameState.winningPlayerIds[0] : undefined)
</script>

<div
    class="mb-2 rounded-lg bg-gray-300 px-2 pt-2 pb-4 text-center flex flex-row flex-wrap justify-center items-center opacity-0"
>
    <div class="flex flex-col justify-center items-center mx-4 w-full">
        <h1 class="text-3xl mb-2">Game Over</h1>

        <div class="flex flex-row justify-center items-center mb-2">
            {#if isWin}
                <h1 class="text-md sm:text-lg">
                    <PlayerName playerId={winner} />
                    won with a score of {gameSession.gameState.getPlayerState(winner ?? 'anyone')
                        ?.score}
                </h1>
            {:else}
                <h1 class="text-lg">
                    {#each gameSession.gameState.winningPlayerIds as winner, i}
                        {#if i > 0}
                            and
                        {/if}
                        <PlayerName playerId={winner} />
                    {/each} tied with a score of {gameSession.gameState.getPlayerState(
                        gameSession.gameState.winningPlayerIds[0]
                    )?.score}
                </h1>
            {/if}
        </div>
    </div>
</div>

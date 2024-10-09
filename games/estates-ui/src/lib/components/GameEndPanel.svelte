<script lang="ts">
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { GameResult } from '@tabletop/common'
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { HTML } from '@threlte/extras'

    let { position, ...others }: { position: [number, number, number] } = $props()

    let gameSession = getContext('gameSession') as EstatesGameSession
    let isWin = $derived(gameSession.gameState.result === GameResult.Win)
    let winner = $derived(isWin ? gameSession.gameState.winningPlayerIds[0] : undefined)
</script>

<HTML {position} {...others} distanceFactor={5} transform>
    <div
        transition:fade={{ duration: 300 }}
        class="mb-2 rounded-lg bg-gray-300 px-2 pt-2 pb-4 text-center flex flex-row flex-wrap justify-center items-center"
    >
        <div class="flex flex-col justify-center items-center mx-4 w-full">
            <h1 class="text-3xl mb-2">Game Over</h1>

            <div class="flex flex-row justify-center items-center mb-2">
                {#if isWin}
                    <h1 class="text-md sm:text-lg">
                        <PlayerName playerId={winner} />
                        wins with a score of {gameSession.gameState.getPlayerState(
                            winner ?? 'anyone'
                        )?.score}
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
</HTML>

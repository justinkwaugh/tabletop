<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'

    let gameSession = getContext('gameSession') as SolGameSession
    let activePlayerId = $derived.by(() => {
        if (gameSession.activePlayers.length === 0) {
            return
        }
        return gameSession.activePlayers[0].id
    })
</script>

<div
    in:fade={{ duration: 300, delay: 100 }}
    out:fade={{ duration: 100 }}
    class="py-2 flex flex-row justify-center items-center h-[50px] sol-font"
>
    <div class="flex flex-col justify-center items-center text-center">
        {#if gameSession.isSolarFlares}
            <div>WAITING FOR PLAYERS TO FINISH ACTIVATIONS</div>
            <div class="flex flex-row justify-center items-center gap-x-2">
                {#each gameSession.gameState.activePlayerIds as playerId (playerId)}
                    <div>
                        <PlayerName
                            {playerId}
                            additionalClasses={'pt-[2px]'}
                            capitalization={'uppercase'}
                        />
                    </div>
                {/each}
            </div>
        {:else}
            WAITING FOR <PlayerName
                playerId={activePlayerId}
                additionalClasses={'pt-[2px]'}
                capitalization={'uppercase'}
            />
            {#if gameSession.isDrawingCards}
                TO DRAW CARDS
            {:else if gameSession.isActivating && gameSession.myPlayerState && gameSession.myPlayerState.playerId !== gameSession.activePlayers[0]?.id}
                TO DECIDE ABOUT THE BONUS
            {/if}
        {/if}
    </div>
</div>

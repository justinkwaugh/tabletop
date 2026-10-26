<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { Player } from '@tabletop/common'
    import type { HydratedBusPlayerState } from '@tabletop/bus'
    import PlayerState from './PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const winnerId = $derived.by(() => gameSession.gameState.winningPlayerIds[0])
    const winnerPlayer = $derived.by(() => {
        if (!winnerId) {
            return undefined
        }
        return gameSession.game.players.find((player) => player.id === winnerId)
    })
    const winnerPlayerState = $derived.by(() => {
        if (!winnerId) {
            return undefined
        }
        return gameSession.gameState.players.find(
            (playerState) => playerState.playerId === winnerId
        )
    })
</script>

<div class="flex flex-col items-center px-4 pt-3 pb-2 text-[#333]">
    <h1 class="text-center text-[24px] font-semibold tracking-[0.02em]">
        Best driver award goes to:
    </h1>

    {#if winnerPlayer && winnerPlayerState}
        <div class="mt-2 w-fit max-w-full">
            <PlayerState
                player={winnerPlayer as Player}
                playerState={winnerPlayerState as HydratedBusPlayerState}
                showInfo={false}
            />
        </div>
    {/if}
</div>

<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedIndonesiaPlayerState, IndonesiaPlayerState } from '@tabletop/indonesia'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()

    type PlayerAndState = { player: Player; playerState: HydratedIndonesiaPlayerState }

    let playersAndStates: PlayerAndState[] = $derived.by(() => {
        const playersAndStates = gameSession.gameState.players.map((playerState) => {
            return {
                player: getPlayerForState(playerState),
                playerState
            }
        })

        const playersAndStatesById = new Map(
            playersAndStates.map((item) => [item.playerState.playerId, item])
        )
        const turnOrderSorted = gameSession.gameState.turnManager.turnOrder.map(
            (playerId) => playersAndStatesById.get(playerId)!
        ) as PlayerAndState[]

        // if not hotseat, rotate until user player is at top
        if (gameSession.myPlayer && !gameSession.primaryGame.hotseat) {
            const myPlayerId = gameSession.myPlayer.id
            if (myPlayerId) {
                while (turnOrderSorted[0].player.id !== myPlayerId) {
                    turnOrderSorted.push(turnOrderSorted.shift()!)
                }
            }
        }

        return turnOrderSorted
    })
    function getPlayerForState(playerState: IndonesiaPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)
    }
</script>

<div class="players-panel-list text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState, index (playerAndState.player.id)}
        <div class="player-state-row {index > 0 ? 'player-state-row-divider' : ''}">
            <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
        </div>
    {/each}
</div>

<style>
    .players-panel-list {
        border-top: 2px solid #7a5d3f;
        border-bottom: 2px solid #7a5d3f;
    }

    .player-state-row-divider {
        border-top: 2px solid #7a5d3f;
    }
</style>

<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedSolPlayerState, SolPlayerState } from '@tabletop/sol'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'

    let gameSession = getContext('gameSession') as SolGameSession

    type PlayerAndState = { player: Player; playerState: HydratedSolPlayerState }

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
    function getPlayerForState(playerState: SolPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)
    }
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.player.id)}
        <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
    {/each}
</div>

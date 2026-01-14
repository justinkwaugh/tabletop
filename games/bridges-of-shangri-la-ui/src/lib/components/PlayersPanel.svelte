<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { BridgesPlayerState } from '@tabletop/bridges-of-shangri-la'
    import PlayerState from '$lib/components/PlayerState.svelte'
import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as BridgesGameSession

    type PlayerAndState = { player: Player; playerState: BridgesPlayerState }

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
        return gameSession.gameState.turnManager.turnOrder.map(
            (playerId) => playersAndStatesById.get(playerId)!
        ) as PlayerAndState[]
    })
    function getPlayerForState(playerState: BridgesPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)
    }
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.playerState.playerId)}
        <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
    {/each}
</div>

<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { FreshFishPlayerState } from '@tabletop/fresh-fish'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession()

    type PlayerAndState = { player: Player; playerState: FreshFishPlayerState }

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
        return gameSession.gameState.turnManager.turnOrder.map((playerId) =>
            playersAndStatesById.get(playerId)!
        ) as PlayerAndState[]
    })
    function getPlayerForState(playerState: FreshFishPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)
    }
</script>

<div class="space-y-2.5 grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.playerState.playerId)}
        <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
    {/each}
</div>

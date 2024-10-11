<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { EstatesPlayerState } from '@tabletop/estates'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    type PlayerAndState = { player: Player; playerState: EstatesPlayerState }

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
    function getPlayerForState(playerState: EstatesPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)
    }
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState}
        <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
    {/each}
</div>

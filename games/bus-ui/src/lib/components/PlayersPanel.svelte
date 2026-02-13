<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedBusPlayerState, BusPlayerState } from '@tabletop/bus'
    import { flip } from 'svelte/animate'
    import { cubicOut } from 'svelte/easing'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()

    type PlayerAndState = { player: Player; playerState: HydratedBusPlayerState }

    let playersAndStates: PlayerAndState[] = $derived.by(() => {
        const allPlayersAndStates = gameSession.gameState.players.map((playerState) => {
            return {
                player: getPlayerForState(playerState),
                playerState
            }
        })

        const playersAndStatesById = new Map(
            allPlayersAndStates.map((item) => [item.playerState.playerId, item])
        )
        const turnOrderSorted = gameSession.gameState.turnManager.turnOrder.map(
            (playerId) => playersAndStatesById.get(playerId)!
        ) as PlayerAndState[]

        const withActionsRemaining = turnOrderSorted.filter((item) => item.playerState.actions > 0)
        const withoutActionsRemaining = turnOrderSorted.filter((item) => item.playerState.actions <= 0)

        return [...withActionsRemaining, ...withoutActionsRemaining]
    })
    function getPlayerForState(playerState: BusPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)
    }
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.player.id)}
        <div animate:flip={{ duration: 320, easing: cubicOut }}>
            <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
        </div>
    {/each}
</div>

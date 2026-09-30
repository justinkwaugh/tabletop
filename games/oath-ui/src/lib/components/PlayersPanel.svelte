<script lang="ts">
    import { assertExists, type Player } from '@tabletop/common'
    import type { HydratedOathPlayerState } from '@tabletop/oath'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { viewerFirst } from '$lib/model/seatOrder.js'

    let gameSession = getGameSession()

    type PlayerAndState = { player: Player; playerState: HydratedOathPlayerState }

    let playersAndStates: PlayerAndState[] = $derived.by(() => {
        const byId = new Map(
            gameSession.gameState.players.map((playerState) => [playerState.playerId, playerState])
        )
        const turnOrderSorted = gameSession.gameState.turnManager.turnOrder.map((playerId) => {
            const playerState = byId.get(playerId)
            assertExists(playerState, `No seat for player ${playerId}`)
            const player = gameSession.game.players.find((p) => p.id === playerId)
            assertExists(player, `No player ${playerId}`)
            return { player, playerState }
        })

        const myPlayerId = gameSession.myPlayer?.id
        return myPlayerId && !gameSession.primaryGame.hotseat
            ? viewerFirst(turnOrderSorted, (seat) => seat.player.id === myPlayerId)
            : turnOrderSorted
    })
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.player.id)}
        <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
    {/each}
</div>

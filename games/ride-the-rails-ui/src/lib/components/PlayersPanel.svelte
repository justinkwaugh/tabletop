<script lang="ts">
    import { assertExists, turnOrderFrom } from '@tabletop/common'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()

    let panelOrder = $derived.by(() => {
        const turnOrder = gameSession.gameState.turnManager.turnOrder
        const myPlayerId = gameSession.primaryGame.hotseat ? undefined : gameSession.myPlayer?.id
        return myPlayerId && turnOrder.includes(myPlayerId)
            ? turnOrderFrom(turnOrder, myPlayerId)
            : turnOrder
    })

    let playersAndStates = $derived(
        panelOrder.map((playerId) => {
            const player = gameSession.game.players.find((candidate) => candidate.id === playerId)
            const playerState = gameSession.gameState.players.find(
                (candidate) => candidate.playerId === playerId
            )
            assertExists(player, `Player ${playerId} is in the game`)
            assertExists(playerState, `Player ${playerId} has a player state`)
            return { player, playerState }
        })
    )
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.player.id)}
        <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
    {/each}
</div>

<script lang="ts">
    import { flip } from 'svelte/animate'
    import { cubicOut } from 'svelte/easing'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerState from './PlayerState.svelte'

    const gameSession = getGameSession()

    const scores = $derived(gameSession.gameState.scores())
    const orderedPlayers = $derived(
        gameSession.gameState.turnManager.turnOrder.map((playerId) =>
            gameSession.gameState.getPlayerState(playerId)
        )
    )
</script>

<div class="space-y-2">
    {#each orderedPlayers as playerState (playerState.playerId)}
        <div animate:flip={{ duration: gameSession.flipPlayerOrder ? 320 : 0, easing: cubicOut }}>
            <PlayerState {playerState} score={scores[playerState.playerId]} />
        </div>
    {/each}
</div>

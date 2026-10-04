<script lang="ts">
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { finalTurnPlayerId }: { finalTurnPlayerId: string } = $props()
    const gameSession = getGameSession()

    let isLastTurn = $derived(gameSession.gameState.turnPlayerId() === finalTurnPlayerId)
</script>

<p role="status" class="mb-2 rounded-md bg-[#8a6a46] px-3 py-1 font-semibold text-white">
    The queue is empty.
    {#if isLastTurn}
        This is the last turn of the game.
    {:else}
        The game ends after <PlayerTag playerId={finalTurnPlayerId} />'s turn.
    {/if}
</p>

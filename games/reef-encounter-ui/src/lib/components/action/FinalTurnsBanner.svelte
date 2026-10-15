<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { GameEndReason } from '@tabletop/reef-encounter'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const lastPlayerId = $derived(state.lastFinalTurnPlayerId())
    const isLastTurn = $derived(state.turnPlayerId() === lastPlayerId)
</script>

{#if state.endingPlayerId && lastPlayerId}
    <p role="status" class="banner">
        {#if state.endReason === GameEndReason.AllTilesLocked}
            <PlayerName playerId={state.endingPlayerId} /> locked the last coral tile.
        {:else}
            <PlayerName playerId={state.endingPlayerId} possessive /> parrotfish ate its fourth shrimp.
        {/if}
        {#if isLastTurn}
            This is the last turn of the game.
        {:else}
            Every other player has one final turn; the game ends after
            {#if lastPlayerId === gameSession.myPlayer?.id}your{:else}<PlayerName
                    playerId={lastPlayerId}
                    possessive
                />{/if} turn.
        {/if}
    </p>
{/if}

<style>
    .banner {
        margin: 0 0 8px;
        padding: 4px 10px;
        border-radius: 6px;
        background: var(--reef-accent);
        color: #1f2f2b;
        font-weight: 700;
    }
</style>

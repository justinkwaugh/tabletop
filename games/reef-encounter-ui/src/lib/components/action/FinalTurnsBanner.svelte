<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const endingPlayerId = $derived(gameSession.gameState.endingPlayerId)
    // The banner shows only in the final turns, when eating returns the larger number.
    const returned = $derived(gameSession.gameState.polypsReturnedWhenEating())
</script>

{#if endingPlayerId}
    <p role="status" class="banner">
        <PlayerName playerId={endingPlayerId} /> ended the game. Everyone else may eat a final coral,
        {returned} polyps back to the bag.
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

    @media (max-width: 639px) {
        .banner {
            font-size: 14px;
        }
    }
</style>

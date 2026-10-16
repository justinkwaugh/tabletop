<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const endingPlayerId = $derived(gameSession.gameState.endingPlayerId)
</script>

{#if endingPlayerId}
    <p role="status" class="banner">
        <PlayerName playerId={endingPlayerId} /> ended the game. Last round.
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

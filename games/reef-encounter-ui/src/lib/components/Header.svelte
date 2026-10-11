<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const turnPlayerId = $derived(gameSession.gameState.activePlayerIds[0])
</script>

<div class="header reef-display">
    <div class="flex items-center gap-1">
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
        {:else if turnPlayerId}
            <PlayerName playerId={turnPlayerId} possessive={true} /> turn
        {/if}
    </div>
    <div class="flex items-center gap-2">
        {#if gameSession.canUndo}
            <button type="button" class="undo" onclick={() => gameSession.undo()}>Undo</button>
        {/if}
        <button
            type="button"
            class="aid"
            aria-label="Player aid"
            aria-expanded={gameSession.playerAidOpen}
            class:open={gameSession.playerAidOpen}
            onclick={() => gameSession.togglePlayerAid()}>?</button
        >
    </div>
</div>

<style>
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 44px;
        padding-inline: 16px;
        font-size: 20px;
    }

    .undo {
        border-radius: 999px;
        padding: 2px 14px;
        font-size: 16px;
        box-shadow: inset 0 0 0 2px var(--reef-line);
    }

    .aid {
        width: 30px;
        height: 30px;
        border-radius: 999px;
        font-size: 18px;
        line-height: 1;
        box-shadow: inset 0 0 0 2px var(--reef-line);
    }

    .aid.open {
        background: var(--reef-ink);
        color: var(--reef-deep);
    }

    .undo:hover,
    .aid:not(.open):hover {
        background: rgb(255 255 255 / 0.12);
    }

    .undo:focus-visible,
    .aid:focus-visible {
        outline: 2px solid var(--reef-accent);
        outline-offset: 2px;
    }

    @media (max-width: 639px) {
        .header {
            height: 32px;
            padding-inline: 8px;
            font-size: 16px;
        }

        .undo {
            font-size: 14px;
            padding: 1px 10px;
        }

        .aid {
            width: 24px;
            height: 24px;
            font-size: 15px;
        }
    }
</style>

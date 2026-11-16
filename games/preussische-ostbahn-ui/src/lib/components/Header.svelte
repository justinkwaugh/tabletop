<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const currentPlayerId = $derived(
        gameSession.gameState.activePlayerIds[0] ??
            gameSession.gameState.turnManager.currentTurn()?.playerId
    )
</script>

<div class="header po-serif">
    <div class="stack">
        {#if gameSession.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>History</div>
        {:else if gameSession.gameState.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>End of game</div>
        {:else if !gameSession.isMyTurn && currentPlayerId}
            <div
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 120 }}
                class="inline-flex gap-x-1"
            >
                <PlayerName playerId={currentPlayerId} possessive={true} />
                <span>turn</span>
            </div>
        {:else}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>Your turn</div>
        {/if}
    </div>
    <div class="stack">
        {#if gameSession.hasLocalSelection || gameSession.undoableAction}
            <button type="button" onclick={() => gameSession.undo()} class="undo">Undo</button>
        {/if}
    </div>
</div>

<style>
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 44px;
        padding: 0 16px;
        color: var(--po-table-ink);
        font-size: 18px;
        font-weight: 700;
    }

    .stack {
        display: grid;
    }

    .stack > * {
        grid-area: 1 / 1;
    }

    .undo {
        border-radius: 0.5rem;
        padding: 0.25rem 0.6rem;
        color: var(--po-table-ink);
    }

    .undo:hover {
        background: rgba(239, 230, 204, 0.12);
    }

    @media (max-width: 639px) {
        .header {
            height: 30px;
            padding: 0 4px;
            font-size: 14px;
        }

        .undo {
            padding: 0.125rem 0.375rem;
        }
    }
</style>

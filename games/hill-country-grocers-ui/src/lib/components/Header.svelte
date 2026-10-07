<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    // Auctions hand the table to other players within one player’s turn.
    const currentTurnPlayerId = $derived(
        gameSession.gameState.activePlayerIds[0] ??
            gameSession.gameState.turnManager.currentTurn()?.playerId
    )
</script>

<div
    class="flex h-[44px] max-sm:h-[30px] items-center justify-between px-4 max-sm:px-1 text-[#3a1a10] tracking-[0.08em]"
>
    <div class="header-grid grid text-[18px] max-sm:text-[14px]">
        {#if gameSession.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>HISTORY</div>
        {:else if gameSession.gameState.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>END OF GAME</div>
        {:else if !gameSession.isMyTurn}
            <div
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 120 }}
                class="inline-flex gap-x-1"
            >
                <PlayerName
                    playerId={currentTurnPlayerId}
                    capitalization="uppercase"
                    possessive={true}
                    additionalClasses="tracking-widest"
                />
                <span>TURN</span>
            </div>
        {:else}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>YOUR TURN</div>
        {/if}
    </div>

    <div class="header-grid grid text-[18px] max-sm:text-[14px]">
        {#if gameSession.hasManualSelection() || gameSession.undoableAction}
            <button type="button" onclick={() => gameSession.undo()} class="header-button"
                >UNDO</button
            >
        {/if}
    </div>
</div>

<style>
    .header-grid > * {
        grid-area: 1 / 1;
    }

    .header-button {
        border-radius: 0.5rem;
        padding: 0.25rem 0.5rem;
        color: #3a1a10;
    }

    @media (max-width: 639px) {
        .header-button {
            padding: 0.125rem 0.375rem;
        }
    }

    .header-button:hover {
        background: rgba(122, 29, 34, 0.1);
    }
</style>

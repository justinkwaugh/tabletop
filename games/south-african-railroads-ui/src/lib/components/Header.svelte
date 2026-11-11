<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const hasRules = $derived(boardLayout(gameSession.gameState.mapId).spec.rules !== undefined)

    // Bids and delegated builds hand the table to other players within one player's turn.
    const currentTurnPlayerId = $derived(
        gameSession.gameState.activePlayerIds[0] ??
            gameSession.gameState.turnManager.currentTurn()?.playerId
    )
</script>

<div
    class="flex h-[44px] max-sm:h-[30px] items-center justify-between px-4 max-sm:px-1 text-[#18222f] tracking-[0.08em]"
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

    <div class="buttons text-[18px] max-sm:text-[14px]">
        {#if gameSession.hasManualSelection() || gameSession.undoableAction}
            <button type="button" onclick={() => gameSession.undo()} class="header-button"
                >UNDO</button
            >
        {/if}
        {#if hasRules}
            <button
                type="button"
                class="rules-button"
                class:open={gameSession.rulesOpen}
                aria-label="Map rules"
                aria-expanded={gameSession.rulesOpen}
                onclick={() => gameSession.toggleRules()}>?</button
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
        color: #18222f;
    }

    @media (max-width: 639px) {
        .header-button {
            padding: 0.125rem 0.375rem;
        }
    }

    .header-button:hover,
    .rules-button:not(.open):hover {
        background: rgba(31, 45, 61, 0.1);
    }

    .buttons {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .rules-button {
        width: 30px;
        height: 30px;
        border: 2px solid #1f2d3d;
        border-radius: 999px;
        color: #1f2d3d;
        font-weight: 700;
        line-height: 1;
    }

    .rules-button.open {
        background: #1f2d3d;
        color: #fdfdfb;
    }

    @media (max-width: 639px) {
        .rules-button {
            width: 24px;
            height: 24px;
        }
    }
</style>

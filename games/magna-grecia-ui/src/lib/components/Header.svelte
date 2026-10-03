<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const currentTurnPlayerId = $derived(gameSession.gameState.turnManager.currentTurn()?.playerId)
</script>

<div
    class="flex h-[44px] max-sm:h-[30px] items-center justify-between border-b max-sm:border-b-0 border-[#d8c7a4] px-4 max-sm:px-1 text-[#4a2c12] tracking-[0.08em]"
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
        color: #4a2c12;
    }

    @media (max-width: 639px) {
        .header-button {
            padding: 0.125rem 0.375rem;
        }
    }

    .header-button:hover {
        background: rgba(107, 63, 29, 0.08);
    }
</style>

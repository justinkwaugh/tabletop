<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const actingPlayerId = $derived(gameSession.gameState.activePlayerIds[0])
    const simultaneous = $derived(gameSession.gameState.activePlayerIds.length > 1)
</script>

<div
    class="flex h-[44px] max-sm:h-[30px] items-center justify-between px-4 max-sm:px-1 text-[#3f2a16] tracking-[0.06em] font-[IM_Fell_English_SC]"
>
    <div class="header-grid grid text-[21px] max-sm:text-[15px]">
        {#if gameSession.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>History</div>
        {:else if gameSession.gameState.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>End of game</div>
        {:else if gameSession.isMyTurn}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>Your turn</div>
        {:else if simultaneous}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>Everyone chooses</div>
        {:else}
            <div
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 120 }}
                class="inline-flex gap-x-1"
            >
                <PlayerName playerId={actingPlayerId} possessive={true} />
                <span>turn</span>
            </div>
        {/if}
    </div>

    <div class="header-grid grid text-[19px] max-sm:text-[14px]">
        {#if gameSession.hasManualSelection() || gameSession.undoableAction}
            <button type="button" onclick={() => gameSession.undo()} class="header-button"
                >Undo</button
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
        padding: 0.25rem 0.6rem;
        color: #3f2a16;
    }

    .header-button:hover {
        background: rgba(63, 42, 22, 0.08);
    }
</style>

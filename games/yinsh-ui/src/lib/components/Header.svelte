<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    // The player to act: the opponent takes rows a move made for them during the mover's turn.
    const actingPlayerId = $derived(session.gameState.activePlayerIds[0])
</script>

<!-- A long name is cut off before it reaches Undo. -->
<div
    class="flex h-[44px] items-center justify-between gap-x-3 px-4 tracking-[0.08em] text-(--yinsh-table-ink) max-sm:h-[30px] max-sm:gap-x-2 max-sm:px-1"
>
    <div class="header-grid grid min-w-0 text-[18px] max-sm:text-[14px]">
        {#if session.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>HISTORY</div>
        {:else if session.gameState.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>END OF GAME</div>
        {:else if !session.isMyTurn}
            <div
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 120 }}
                class="flex min-w-0 gap-x-1"
            >
                <PlayerName
                    playerId={actingPlayerId}
                    capitalization="uppercase"
                    possessive={true}
                    additionalClasses="min-w-0 truncate tracking-widest"
                />
                <span class="shrink-0">TURN</span>
            </div>
        {:else}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>YOUR TURN</div>
        {/if}
    </div>

    <div class="header-grid grid shrink-0 text-[18px] max-sm:text-[14px]">
        {#if session.hasLocalSelection || session.undoableAction}
            <button type="button" onclick={() => session.undo()} class="header-button">UNDO</button>
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
    }

    .header-button:hover {
        background: rgb(13 22 38 / 0.08);
    }

    @media (max-width: 639px) {
        .header-button {
            padding: 0.125rem 0.375rem;
        }
    }
</style>

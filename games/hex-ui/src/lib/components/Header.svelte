<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()
    // Full screen draws a second header in its dialog; each anchors its own guide.
    const uid = $props.id()
    const headerId = `hex-header-${uid}`

    const currentTurnPlayerId = $derived(session.gameState.turnManager.currentTurn()?.playerId)
</script>

<div
    id={headerId}
    class="relative flex h-[44px] items-center justify-between px-4 tracking-[0.08em] text-(--hex-table-ink) max-sm:h-[30px] max-sm:px-1"
>
    <div class="header-grid grid text-[18px] max-sm:text-[14px]">
        {#if session.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>HISTORY</div>
        {:else if session.gameState.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>END OF GAME</div>
        {:else if !session.isMyTurn}
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

    <div class="flex items-center gap-x-2">
        <div class="header-grid grid text-[18px] max-sm:text-[14px]">
            {#if session.hasLocalSelection || session.undoableAction}
                <button type="button" onclick={() => session.undo()} class="header-button"
                    >UNDO</button
                >
            {/if}
        </div>
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

    @media (hover: hover) {
        .header-button:hover {
            background: rgb(60 40 20 / 0.08);
        }
    }

    @media (max-width: 639px) {
        .header-button {
            padding: 0.125rem 0.375rem;
        }
    }
</style>

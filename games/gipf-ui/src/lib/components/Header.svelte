<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Legend from './Legend.svelte'

    const session = getGameSession()
    // Full screen may draw a second header; each anchors its own reference panel.
    const uid = $props.id()
    const headerId = `header-${uid}`

    const currentTurnPlayerId = $derived(session.gameState.turnManager.currentTurn()?.playerId)
</script>

<div
    id={headerId}
    class="flex h-[44px] items-center justify-between px-4 tracking-[0.08em] text-(--gipf-ink) max-sm:h-[30px] max-sm:px-1"
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

    <div class="flex items-center gap-2 max-sm:gap-1.5">
        <div class="header-grid grid text-[18px] max-sm:text-[14px]">
            {#if session.hasLocalSelection || session.undoableAction}
                <button type="button" onclick={() => session.undo()} class="header-button"
                    >UNDO</button
                >
            {/if}
        </div>
        <Legend reference={`#${headerId}`} />
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
        background: rgb(255 255 255 / 0.08);
    }

    @media (max-width: 639px) {
        .header-button {
            padding: 0.125rem 0.375rem;
        }
    }
</style>

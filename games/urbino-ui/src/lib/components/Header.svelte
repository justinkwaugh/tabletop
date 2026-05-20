<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)

    const activePlayerId = $derived(state.activePlayerIds[0])
    const canUndo = $derived(session.canUndoPlacement || session.canUndoReposition)
</script>

<div
    class="flex h-[44px] items-center justify-between border-b border-[#c8bfaf] bg-[#f0ebe2] px-4 tracking-[0.08em] text-[#6b5040]"
>
    <div class="header-grid grid text-[18px]">
        {#if session.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>HISTORY</div>
        {:else if state.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>END OF GAME</div>
        {:else if !session.isMyTurn}
            <div
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 120 }}
                class="inline-flex gap-x-1"
            >
                <PlayerName
                    playerId={activePlayerId}
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

    <div class="header-grid grid text-[18px]">
        {#if canUndo}
            <button
                type="button"
                onclick={() => session.undo()}
                class="rounded-lg px-2 py-1 text-[#6b5040] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b3a2a]/40"
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 120 }}
            >
                UNDO
            </button>
        {/if}
    </div>
</div>

<style>
    .header-grid > * {
        grid-area: 1 / 1;
    }
</style>

<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import type { BusGameSession } from '$lib/model/session.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession() as BusGameSession

    const currentTurnPlayerId = $derived.by(
        () => gameSession.gameState.turnManager.currentTurn()?.playerId
    )
    const midAction = $derived.by(
        () =>
            !!gameSession.chosenSite ||
            !!gameSession.chosenPassengerStationId ||
            !!gameSession.pendingBusLineTargetNodeId
    )

    function back() {
        gameSession.back()
    }

    async function undo() {
        await gameSession.undo()
    }
</script>

<div
    id="bus-header"
    class="flex h-[44px] items-center justify-between border-b border-[#c9ccd1] px-4 text-[#333] tracking-[0.08em]"
>
    <div class="header-grid grid text-[18px]">
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

    <div class="header-grid grid text-[18px]">
        {#if midAction}
            <button
                type="button"
                onclick={back}
                class="rounded-lg px-2 py-1 text-[#333] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d6979]/60"
            >
                UNDO
            </button>
        {:else if gameSession.undoableAction}
            <button
                type="button"
                onclick={undo}
                class="rounded-lg px-2 py-1 text-[#333] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d6979]/60"
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

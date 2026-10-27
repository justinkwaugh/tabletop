<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MachineState } from '@tabletop/power-grid'

    const session = getGameSession()

    const actingPlayerId = $derived(
        session.gameState.machineState === MachineState.Powering
            ? undefined
            : session.gameState.activePlayerIds[0]
    )
</script>

<div class="header">
    <div class="stack text-[20px] max-sm:text-[15px]">
        {#if session.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>History</div>
        {:else if session.gameState.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>End of game</div>
        {:else if session.canAct}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>Your turn</div>
        {:else if actingPlayerId}
            <div
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 120 }}
                class="inline-flex gap-x-1"
            >
                <PlayerName playerId={actingPlayerId} possessive={true} />
                <span>turn</span>
            </div>
        {:else}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>Bureaucracy</div>
        {/if}
    </div>
    <div class="stack text-[18px] max-sm:text-[14px]">
        {#if session.hasManualSelection || session.undoableAction}
            <button type="button" class="undo" onclick={() => session.undo()}>Undo</button>
        {/if}
    </div>
</div>

<style>
    .header {
        display: flex;
        height: 44px;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        color: #ecebe1;
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    .stack {
        display: grid;
    }
    .stack > :global(*) {
        grid-area: 1 / 1;
    }
    .undo {
        border: 2px solid #8d987a;
        border-radius: 6px;
        padding: 0 12px;
        color: #ecebe1;
        text-transform: uppercase;
    }
    .undo:hover {
        background: rgb(255 255 255 / 0.08);
    }
    @media (max-width: 639px) {
        .header {
            height: 32px;
            padding: 0 4px;
        }
    }
</style>

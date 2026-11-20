<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/feudum'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /** R-3.1-H1, R-4.10-H4 Hand choice and nourishing ask every seat at once: no seat is next. */
    const gameSession = getGameSession()

    let activeId = $derived(gameSession.gameState.activePlayerIds[0])
    let choosingHands = $derived(gameSession.gameState.machineState === MachineState.SelectingHands)
    let handSet = $derived(gameSession.handPanel?.set !== undefined)
    let nourishing = $derived(gameSession.gameState.machineState === MachineState.Nourishing)
</script>

<div
    class="flex h-[40px] max-sm:h-[28px] items-center justify-between px-4 max-sm:px-1 text-feudum-heading"
    data-table-header
>
    <div class="text-lg max-sm:text-sm tracking-wide" style:font-family="var(--feudum-font-title)">
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
        {:else if handSet}
            Hand set
        {:else if choosingHands}
            Choose hands
        {:else if nourishing}
            Feeding
        {:else if activeId}
            <span class="inline-flex gap-x-1">
                <PlayerName playerId={activeId} possessive={true} />
                <span>turn</span>
            </span>
        {/if}
    </div>
    {#if gameSession.hasLocalSelection || gameSession.undoableAction}
        <button
            type="button"
            class="undo rounded-lg px-2 py-1 max-sm:px-1.5 max-sm:py-0.5 bg-feudum-control hover:bg-feudum-control-hover text-feudum-text"
            onclick={() => gameSession.undo()}>Undo</button
        >
    {/if}
</div>

<style>
    /* 44 px to press on a phone, over the strip beneath the 28 px header. */
    @media (width < 40rem) {
        .undo {
            position: relative;
            min-width: 44px;
        }

        .undo::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            left: 0;
            height: 44px;
        }
    }
</style>

<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/feudum'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /**
     * Whose turn it is, or History, or the game's end; and the one Undo. While hands are chosen no
     * seat is next (R-3.1-H1), so a seat not choosing reads the step.
     */
    const gameSession = getGameSession()

    let activeId = $derived(gameSession.gameState.activePlayerIds[0])
    let choosingHands = $derived(gameSession.gameState.machineState === MachineState.SelectingHands)
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
        {:else if choosingHands}
            Choosing hands
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
    /* 44 px to press on a phone, over the strip beneath the 28 px header it is drawn in. */
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

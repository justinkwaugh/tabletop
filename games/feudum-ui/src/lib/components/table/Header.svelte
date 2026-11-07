<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /** Whose turn it is, or History, or the game's end; and the one Undo. */
    const gameSession = getGameSession()

    let activeId = $derived(gameSession.gameState.activePlayerIds[0])
</script>

<div
    class="flex h-[40px] max-sm:h-[30px] items-center justify-between px-4 max-sm:px-1 text-feudum-heading"
    data-table-header
>
    <div class="text-lg max-sm:text-sm tracking-wide" style:font-family="var(--feudum-font-title)">
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
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
            class="rounded-lg px-2 py-1 max-sm:px-1.5 max-sm:py-0.5 bg-feudum-control hover:bg-feudum-control-hover text-feudum-text"
            onclick={() => gameSession.undo()}>Undo</button
        >
    {/if}
</div>

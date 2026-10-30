<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const heading = $derived.by(() => {
        if (gameSession.isViewingHistory) {
            return 'History'
        }
        if (gameSession.gameState.result) {
            return 'End of game'
        }
        if (gameSession.decidingPlayerId !== undefined) {
            return 'Your turn'
        }
        const activeId = gameSession.gameState.activePlayerIds.at(0)
        return activeId === undefined ? '' : `${gameSession.getPlayerName(activeId)}'s turn`
    })
</script>

<div
    class="flex h-11 items-center justify-between gap-3 border-b border-pp-halo/40 px-4 max-sm:h-9 max-sm:px-2"
>
    <h2 class="pp-heading text-xl max-sm:text-base">{heading}</h2>
    <!-- R-X.2: shown only when a press would do something; a draw leaves nothing to undo. -->
    {#if gameSession.canUndo}
        <button
            type="button"
            class="rounded-md bg-pp-accent px-3.5 py-1 text-sm font-bold text-pp-accent-ink"
            onclick={() => gameSession.undo()}>Undo</button
        >
    {/if}
</div>

<style>
    .pp-heading {
        font-family: Oswald, sans-serif;
        font-weight: 500;
    }
</style>

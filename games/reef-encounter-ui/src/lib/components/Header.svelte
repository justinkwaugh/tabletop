<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const turnPlayerId = $derived(gameSession.gameState.activePlayerIds[0])
</script>

<div
    class="flex h-[44px] max-sm:h-[32px] items-center justify-between px-4 max-sm:px-2 text-lg max-sm:text-sm"
>
    <div>
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
        {:else if turnPlayerId}
            <PlayerName playerId={turnPlayerId} possessive={true} /> turn
        {/if}
    </div>
    {#if gameSession.undoableAction}
        <button
            type="button"
            class="rounded-md px-2 py-1 hover:bg-white/10"
            onclick={() => gameSession.undo()}
        >
            Undo
        </button>
    {/if}
</div>

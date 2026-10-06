<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let turnPlayerId = $derived(gameSession.gameState.turnManager.currentTurn()?.playerId)
</script>

<div
    class="marracash-display flex h-9 items-center justify-between border-b border-[#d9c7a3] px-1 text-sm tracking-[0.08em] uppercase"
>
    <div>
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
        {:else if turnPlayerId}
            <PlayerName
                playerId={turnPlayerId}
                possessive={true}
                capitalization="uppercase"
                additionalClasses="tracking-[0.08em]"
            />
            turn
        {/if}
    </div>
    <div class="flex items-center">
        {#if gameSession.canUndo}
            <button
                type="button"
                class="h-9 rounded-md px-3 tracking-[0.08em] uppercase hover:bg-[#8a6a46]/15 disabled:opacity-40"
                disabled={gameSession.busy}
                onclick={() => gameSession.undo()}>Undo</button
            >
        {/if}
        <button
            type="button"
            aria-label="Player aid"
            aria-expanded={gameSession.playerAidOpen}
            class="group flex h-9 w-9 items-center justify-center"
            onclick={() => gameSession.togglePlayerAid()}
        >
            <span
                class="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] text-[15px] leading-none tracking-normal {gameSession.playerAidOpen
                    ? 'border-[#5e2716] bg-[#8a3d26] text-[#f8ecd2]'
                    : 'border-[#8a6a46] bg-[#efe0c0] text-[#3d2f1f] group-hover:bg-[#e3cfa8]'}"
                >?</span
            >
        </button>
    </div>
</div>

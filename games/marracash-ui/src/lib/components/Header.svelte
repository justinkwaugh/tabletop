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
            Game over
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
    <div class="flex items-center gap-1.5">
        {#if gameSession.canUndo}
            <button
                type="button"
                class="rounded-md px-2 py-0.5 tracking-[0.08em] uppercase hover:bg-[#8a6a46]/15 disabled:opacity-40"
                disabled={gameSession.busy}
                onclick={() => gameSession.undo()}>Undo</button
            >
        {/if}
        <button
            type="button"
            aria-label="Player aid"
            aria-expanded={gameSession.playerAidOpen}
            class="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] text-[15px] leading-none tracking-normal {gameSession.playerAidOpen
                ? 'border-[#5e2716] bg-[#8a3d26] text-[#f8ecd2]'
                : 'border-[#8a6a46] bg-[#efe0c0] text-[#3d2f1f] hover:bg-[#e3cfa8]'}"
            onclick={() => gameSession.togglePlayerAid()}>?</button
        >
    </div>
</div>

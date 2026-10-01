<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ENDINGS, recordedWinner } from '$lib/model/endings.js'
    import { recordedWinRule } from '$lib/model/actionLog.js'

    // R-3 — which of the four endings fired, read from the action log.
    let gameSession = getGameSession()
    let state = $derived(gameSession.gameState)

    let winner = $derived(recordedWinner(state))
    let wonBy = $derived(recordedWinRule(gameSession.actions))
</script>

<div
    class="mb-2 rounded-lg bg-stone-900/80 border border-amber-500/40 px-3 py-3
           text-center text-stone-100"
>
    <h1 class="text-2xl tracking-[0.2em] uppercase text-amber-200 mb-1">The game is over</h1>

    <p class="text-lg">
        <PlayerName playerId={winner} /> won
        {#if wonBy}
            <span class="text-stone-300">{ENDINGS[wonBy]}</span>
        {/if}
    </p>
</div>

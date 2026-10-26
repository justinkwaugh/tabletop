<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { endingParts, recordedWinner } from '$lib/model/endings.js'
    import { endingRule } from '$lib/model/majorEvents.js'

    // R-3 — which of the four endings fired, read from the action log; the History says why.
    let gameSession = getGameSession()
    let state = $derived(gameSession.gameState)

    let winner = $derived(recordedWinner(state))
    let wonBy = $derived(endingRule(gameSession.actions))
</script>

<div
    class="mb-2 rounded-lg bg-oath-surface border border-oath-frame px-3 py-3
           text-center text-oath-text"
>
    <h1 class="text-2xl tracking-[0.2em] uppercase text-oath-heading mb-1">The game is over</h1>

    <p class="text-lg">
        <PlayerName playerId={winner} /> won
        {#if wonBy}
            <span class="text-oath-text-muted">{endingParts(wonBy).how}</span>
        {/if}
    </p>
</div>

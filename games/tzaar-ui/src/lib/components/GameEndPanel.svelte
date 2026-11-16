<script lang="ts">
    import { assert, assertExists } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { KIND_NAMES } from '$lib/history/entryText.js'

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    // Rules B1 and G, read from the final position: the loser has no Tzaar, Tzarra or Tott left on
    // top, or could not capture as their turn began.
    const outcome = $derived.by(() => {
        if (session.gameCall) return undefined
        const state = session.gameState
        const [winner] = state.winningPlayerIds
        assertExists(winner, 'A finished game has a winner')
        const loser = state.opponentOf(winner)
        const loserName = session.getPlayerName(loser)
        const missing = state.missingKind(loser)
        if (missing !== undefined) {
            return { winner, reason: `${loserName} has no ${KIND_NAMES[missing]} left` }
        }
        assert(!state.canCapture(loser), 'A game is won by taking a type or leaving no capture')
        return { winner, reason: `${loserName} cannot capture` }
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--tzaar-ink)">
    {#if outcome}
        <div class="text-[22px] font-semibold tracking-[0.06em]">
            {outcome.winner === session.myPlayer?.id ? 'You win' : `${nameOf(outcome.winner)} wins`}
        </div>
        <div class="text-[15px] text-(--tzaar-ink-quiet)">{outcome.reason}</div>
    {:else}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {/if}
</div>

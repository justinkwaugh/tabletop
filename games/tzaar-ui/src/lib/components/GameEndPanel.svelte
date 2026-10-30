<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import { KIND_NAMES } from '$lib/history/entryText.js'

    const session = getGameSession()

    const winner = $derived(session.gameState.winningPlayerIds[0])
    const lastEntry = $derived(historyEntries(session.actions).at(-1))

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    // Rule G: the loser ran out of a type on top, or could not capture.
    const reason = $derived.by(() => {
        if (winner === undefined || lastEntry === undefined) return ''
        const loser = session.gameState.opponentOf(winner)
        if (lastEntry.kind === 'capture' && lastEntry.eliminated !== undefined) {
            return `${session.getPlayerName(loser)} has no ${KIND_NAMES[lastEntry.eliminated]} left`
        }
        return `${session.getPlayerName(loser)} cannot capture`
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--tzaar-ink)">
    <div class="text-[22px] font-semibold tracking-[0.06em]">
        {#if winner}
            {winner === session.myPlayer?.id ? 'You win' : `${nameOf(winner)} wins`}
        {/if}
    </div>
    <div class="text-[15px] text-(--tzaar-ink-quiet)">{reason}</div>
</div>

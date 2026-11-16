<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { EndReason } from '@tabletop/gipf-potentials'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winnerId = $derived.by(() => {
        const [winner] = session.gameState.winningPlayerIds
        assertExists(winner, 'Every GIPF with Potentials game ends with one winner')
        return winner
    })
    const loserId = $derived(session.gameState.opponentOf(winnerId))

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const reason = $derived.by(() => {
        const endReason = session.gameState.endReason
        assertExists(endReason, 'A finished game records why it ended')
        switch (endReason) {
            case EndReason.NoGipfPieces:
                return `${nameOf(loserId)} lost the last GIPF piece`
            case EndReason.NoMoves:
                return `${nameOf(loserId)} had no move left`
        }
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--gp-ink)">
    <div class="text-[22px] font-semibold tracking-[0.06em]">
        {winnerId === session.myPlayer?.id ? 'You win' : `${nameOf(winnerId)} wins`}
    </div>
    <div class="text-[15px] text-(--gp-ink-quiet)">{reason}</div>
</div>

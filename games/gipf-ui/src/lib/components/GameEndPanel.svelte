<script lang="ts">
    import { EndReason } from '@tabletop/gipf'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winnerId = $derived(session.gameState.winningPlayerIds[0])
    const loserId = $derived(winnerId ? session.gameState.opponentOf(winnerId) : undefined)

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const reason = $derived.by(() => {
        if (!loserId) return ''
        switch (session.gameState.endReason) {
            case EndReason.NoGipfPieces:
                return `${nameOf(loserId)} lost the last GIPF-piece`
            case EndReason.NoReserve:
                return `${nameOf(loserId)} had no piece left to bring in`
            case EndReason.Blocked:
                return `${nameOf(loserId)} had no line to push along`
            default:
                return ''
        }
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--gipf-ink)">
    {#if winnerId}
        <div class="text-[22px] font-semibold tracking-[0.06em]">
            {winnerId === session.myPlayer?.id ? 'You win' : `${nameOf(winnerId)} wins`}
        </div>
        <div class="text-[15px] text-(--gipf-ink-quiet)">{reason}</div>
    {/if}
</div>

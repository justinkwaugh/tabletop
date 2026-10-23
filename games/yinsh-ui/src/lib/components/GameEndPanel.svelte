<script lang="ts">
    import { EndReason } from '@tabletop/yinsh'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winners = $derived(session.gameState.winningPlayerIds)
    const isDraw = $derived(winners.length > 1)

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const reason = $derived.by(() => {
        const { gameState } = session
        if (gameState.endReason === EndReason.Rows) {
            const rows = gameState.ringsToWin === 1 ? 'a row' : `${gameState.ringsToWin} rows`
            return `${nameOf(winners[0])} formed ${rows}`
        }
        const ended =
            gameState.endReason === EndReason.PoolEmpty
                ? 'The markers ran out'
                : 'Neither player could move'
        const counts = gameState.players
            .map((player) => player.ringsRemoved)
            .toSorted((a, b) => b - a)
            .join(' to ')
        return `${ended}; rings removed ${counts}`
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--yinsh-ink)">
    <div class="text-[22px] font-semibold tracking-[0.06em]">
        {#if isDraw}
            A draw
        {:else if winners[0]}
            {winners[0] === session.myPlayer?.id ? 'You win' : `${nameOf(winners[0])} wins`}
        {/if}
    </div>
    <div class="text-[15px] text-(--yinsh-ink-quiet)">{reason}</div>
</div>

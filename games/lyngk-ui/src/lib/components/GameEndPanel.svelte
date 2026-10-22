<script lang="ts">
    import { EndReason } from '@tabletop/lyngk'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winners = $derived(session.gameState.winningPlayerIds)
    const isDraw = $derived(winners.length > 1)

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const HEIGHTS = ['stacks of 5', 'stacks of 4', 'stacks of 3', 'stacks of 2', 'single pieces']

    // Names the count that decided the game: stacks of 5 first, then 4s, 3s, 2s and singles.
    const reason = $derived.by(() => {
        const { gameState } = session
        if (gameState.endReason === EndReason.StackOfSix) {
            return `${nameOf(winners[0])} completed a stack of 6`
        }
        const [first, second] = gameState.players.map((player) =>
            gameState.rankingOf(player.playerId)
        )
        const decider = first.findIndex((count, index) => count !== second[index])
        if (decider < 0) return 'Every count is equal'
        const counts = [first[decider], second[decider]].toSorted((a, b) => b - a).join(' to ')
        const level = decider === 0 ? '' : `Level on ${HEIGHTS.slice(0, decider).join(', ')}; `
        return `${level}decided on ${HEIGHTS[decider]}, ${counts}`
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--lyngk-ink)">
    <div class="text-[22px] font-semibold tracking-[0.06em]">
        {#if isDraw}
            A draw
        {:else if winners[0]}
            {winners[0] === session.myPlayer?.id ? 'You win' : `${nameOf(winners[0])} wins`}
        {/if}
    </div>
    <div class="text-[15px] text-(--lyngk-ink-quiet)">{reason}</div>
</div>

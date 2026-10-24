<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winners = $derived(session.gameState.winningPlayerIds)
    const isDraw = $derived(winners.length > 1)

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    // Rule G2: each player's stacks piled together; the higher pile wins.
    const reason = $derived(
        `No moves remain; pieces controlled ${session.gameState.players
            .map((player) => session.gameState.score(player.playerId))
            .toSorted((a, b) => b - a)
            .join(' to ')}`
    )
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--dvonn-ink)">
    <div class="text-[22px] font-semibold tracking-[0.06em]">
        {#if isDraw}
            A draw
        {:else if winners[0]}
            {winners[0] === session.myPlayer?.id ? 'You win' : `${nameOf(winners[0])} wins`}
        {/if}
    </div>
    <div class="text-[15px] text-(--dvonn-ink-quiet)">{reason}</div>
</div>

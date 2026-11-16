<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winners = $derived(session.gameState.winningPlayerIds)
    const isDraw = $derived(winners.length > 1)
    // A finished game names at least one winner.
    const winner = $derived.by(() => {
        const [first] = winners
        assertExists(first, 'A finished game has a winner')
        return first
    })

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    // Rule G2: each player's stacks piled together; the higher pile wins.
    const reason = $derived(
        `No moves remain; stack height ${session.gameState.players
            .map((player) => session.gameState.score(player.playerId))
            .toSorted((a, b) => b - a)
            .join(' to ')}`
    )
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--dvonn-ink)">
    <div class="text-[22px] font-semibold tracking-[0.06em]">
        {#if isDraw}
            A draw
        {:else}
            {winner === session.myPlayer?.id ? 'You win' : `${nameOf(winner)} wins`}
        {/if}
    </div>
    <div class="text-[15px] text-(--dvonn-ink-quiet)">{reason}</div>
</div>

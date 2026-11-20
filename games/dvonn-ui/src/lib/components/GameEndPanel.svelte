<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    // Rule G2: each player's stacks piled together; the higher pile wins.
    const outcome = $derived.by(() => {
        if (session.gameCall) return undefined
        const winners = session.gameState.winningPlayerIds
        const [winner] = winners
        assertExists(winner, 'A finished game has a winner')
        const heights = session.gameState.players
            .map((player) => session.gameState.score(player.playerId))
            .toSorted((a, b) => b - a)
            .join(' to ')
        return {
            winner,
            isDraw: winners.length > 1,
            reason: `No moves remain; stack height ${heights}`
        }
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--dvonn-ink)">
    {#if outcome}
        <div class="text-[22px] font-semibold tracking-[0.06em]">
            {#if outcome.isDraw}
                A draw
            {:else}
                {outcome.winner === session.myPlayer?.id
                    ? 'You win'
                    : `${nameOf(outcome.winner)} wins`}
            {/if}
        </div>
        <div class="text-[15px] text-(--dvonn-ink-quiet)">{outcome.reason}</div>
    {:else}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {/if}
</div>

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

<div class="ending">
    {#if outcome}
        <span class="winner">
            {#if outcome.isDraw}
                A draw
            {:else}
                {outcome.winner === session.myPlayer?.id
                    ? 'You win'
                    : `${nameOf(outcome.winner)} wins`}
            {/if}
        </span>
        <span class="reason" title={outcome.reason}>{outcome.reason}</span>
    {:else}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {/if}
</div>

<style>
    /* Within the height the action panel holds: the winner over the reason, the reason trimmed
       rather than wrapped. */
    .ending {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        line-height: 1.2;
    }

    .winner {
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.06em;
        white-space: nowrap;
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .reason {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 15px;
        color: var(--dvonn-ink-quiet);
    }

    @media (max-width: 639px) {
        .reason {
            font-size: 13px;
        }
    }
</style>

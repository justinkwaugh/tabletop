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
    /* Inside the action panel, at its height: one row, or on phones the reason on a smaller second
       line, trimmed rather than wrapped further. */
    .ending {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 0.5em;
        min-width: 0;
        max-width: 100%;
    }

    .winner {
        flex-shrink: 0;
        font-weight: 600;
        white-space: nowrap;
    }

    .reason {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--dvonn-ink-quiet);
    }

    .reason::before {
        content: '· ';
    }

    @media (max-width: 639px) {
        .ending {
            flex-direction: column;
            align-items: center;
            gap: 0;
            line-height: 1.2;
        }

        .reason {
            max-width: 100%;
            font-size: 13px;
        }

        .reason::before {
            content: none;
        }
    }
</style>

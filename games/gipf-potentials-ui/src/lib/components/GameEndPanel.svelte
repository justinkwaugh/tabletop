<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
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

<div class="ending">
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else}
        <span class="winner">
            {winnerId === session.myPlayer?.id ? 'You win' : `${nameOf(winnerId)} wins`}
        </span>
        <span class="reason" title={reason}>{reason}</span>
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
        color: var(--gp-ink-quiet);
    }

    @media (max-width: 639px) {
        .reason {
            font-size: 13px;
        }
    }
</style>

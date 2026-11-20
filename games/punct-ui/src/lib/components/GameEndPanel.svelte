<script lang="ts">
    import { assertExists, GameResult } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { EndReason } from '@tabletop/punct'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const state = $derived(session.gameState)
    const draw = $derived(state.result === GameResult.Draw)

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    function winnerId(): string {
        const [winner] = state.winningPlayerIds
        assertExists(winner, 'A game won has its winner')
        return winner
    }

    function centreCount(playerId: string): number {
        return state.board.centreCount(playerId)
    }

    function headline(): string {
        if (draw) return 'A draw'
        const winner = winnerId()
        return winner === session.myPlayer?.id ? 'You win' : `${nameOf(winner)} wins`
    }

    function reason(): string {
        const endReason = state.endReason
        assertExists(endReason, 'A finished game records why it ended')
        switch (endReason) {
            case EndReason.Connection:
                return `${nameOf(winnerId())} linked two opposite sides`
            case EndReason.CentreCount: {
                if (draw) {
                    const [first] = state.players
                    return `Last piece placed: ${centreCount(first.playerId)} central spaces each`
                }
                const winner = winnerId()
                const loser = state.opponentOf(winner)
                return `Last piece placed: ${centreCount(winner)} central spaces to ${centreCount(loser)}`
            }
            case EndReason.LastPiece:
                return 'Last piece placed with no connection'
            case EndReason.NoMoves:
                return 'Neither player could move'
        }
    }

    const outcome = $derived(
        session.gameCall ? undefined : { headline: headline(), reason: reason() }
    )
</script>

<div class="ending">
    {#if outcome}
        <span class="winner">{outcome.headline}</span>
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
        color: var(--punct-ink-quiet);
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

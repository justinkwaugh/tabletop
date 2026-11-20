<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { EndReason } from '@tabletop/yinsh'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const ENDINGS: Record<Exclude<EndReason, EndReason.Rows>, string> = {
        [EndReason.PoolEmpty]: 'The markers ran out',
        [EndReason.NoMoves]: 'Neither player could move'
    }

    const winners = $derived(session.gameState.winningPlayerIds)
    const isDraw = $derived(winners.length > 1)

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const reason = $derived.by(() => {
        if (session.gameCall) return undefined
        const { gameState } = session
        if (gameState.endReason === EndReason.Rows) {
            const rows = gameState.ringsToWin === 1 ? 'a row' : `${gameState.ringsToWin} rows`
            return `${nameOf(winners[0])} formed ${rows}`
        }
        assertExists(gameState.endReason, 'A finished game records why it ended')
        const ended = ENDINGS[gameState.endReason]
        const counts = gameState.players
            .map((player) => player.ringsRemoved)
            .toSorted((a, b) => b - a)
            .join(' to ')
        return `${ended}; rings removed ${counts}`
    })
</script>

<div class="ending">
    {#if reason}
        <span class="winner">
            {#if isDraw}
                A draw
            {:else if winners[0]}
                {winners[0] === session.myPlayer?.id ? 'You win' : `${nameOf(winners[0])} wins`}
            {/if}
        </span>
        <span class="reason" title={reason}>{reason}</span>
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
        color: var(--yinsh-ink-quiet);
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

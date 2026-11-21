<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { EndReason } from '@tabletop/yinsh'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const ENDINGS: Record<Exclude<EndReason, EndReason.Rows>, string> = {
        [EndReason.PoolEmpty]: 'Markers ran out',
        [EndReason.NoMoves]: 'No moves left'
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
        return `${ended}; rings ${counts}`
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
        color: var(--yinsh-ink-quiet);
    }

    @media (max-width: 639px) {
        .reason {
            font-size: 13px;
        }
    }
</style>

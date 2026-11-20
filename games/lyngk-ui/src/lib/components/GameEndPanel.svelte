<script lang="ts">
    import { CalledGameEnding } from '@tabletop/frontend-components'
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
        if (session.gameCall) return undefined
        const { gameState } = session
        if (gameState.endReason === EndReason.StackOfSix) {
            const [winner] = winners
            if (winner === undefined) throw Error('A stack of 6 has its winner')
            return `${nameOf(winner)} completed a stack of 6`
        }
        const decider = gameState.deciderIndex()
        if (decider === undefined) return 'Every count is equal'
        const counts = gameState.players
            .map((player) => gameState.rankingOf(player.playerId)[decider])
            .toSorted((a, b) => b - a)
            .join(' to ')
        const level = decider === 0 ? '' : `Level on ${HEIGHTS.slice(0, decider).join(', ')}; `
        return `${level}decided on ${HEIGHTS[decider]}, ${counts}`
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
        color: var(--lyngk-ink-quiet);
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

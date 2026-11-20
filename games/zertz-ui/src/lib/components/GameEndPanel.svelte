<script lang="ts">
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { EndReason } from '@tabletop/zertz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { victoryOf } from '$lib/model/victory.js'
    import { textSeed } from '$lib/board/marbleSeeds.js'
    import MarbleIcon from './MarbleIcon.svelte'

    const session = getGameSession()

    const winnerId = $derived(session.gameState.winningPlayerIds[0])
    // A called game ends with no end reason and perhaps no winner, so it tells no victory.
    const victory = $derived(session.gameCall ? undefined : victoryOf(session.gameState))

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const verdict = $derived.by(() => {
        if (victory?.reason === EndReason.Repetition) return 'Drawn'
        return winnerId === session.myPlayer?.id ? 'You win' : `${nameOf(winnerId)} wins`
    })
</script>

<div class="ending">
    {#if victory}
        <span class="winner">{verdict}</span>
        <span class="reason">
            {#if victory.reason === EndReason.FullBoard}
                by filling the last ring on the board
            {:else if victory.reason === EndReason.Repetition}
                the same position came round a third time
            {:else if victory.reason === EndReason.NoMarbles}
                {nameOf(victory.loserId)} had no marble to place
            {:else if 'color' in victory}
                with {victory.count}
                <MarbleIcon color={victory.color} seed={textSeed('game end')} size={16} />
                {victory.color} marbles
            {:else}
                with {victory.eachColor} marbles of each colour
            {/if}
        </span>
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
        color: var(--zertz-ink-quiet);
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

    .reason :global(svg) {
        display: inline-block;
        vertical-align: -2px;
    }
</style>

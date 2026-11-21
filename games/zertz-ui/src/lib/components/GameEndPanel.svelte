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
    /* Within the height the action panel holds: the winner over the reason, the reason trimmed
       rather than wrapped. */
    .ending {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        line-height: 1.1;
    }

    .winner {
        font-size: 18px;
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
        font-size: 13px;
        color: var(--zertz-ink-quiet);
    }

    .reason :global(svg) {
        display: inline-block;
        vertical-align: -2px;
    }

    @media (max-width: 639px) {
        .reason {
            font-size: 13px;
        }
    }
</style>

<script lang="ts">
    import { assert, assertExists } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { KIND_NAMES } from '$lib/history/entryText.js'

    const session = getGameSession()

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    // Rules B1 and G, read from the final position: the loser has no Tzaar, Tzarra or Tott left on
    // top, or could not capture as their turn began.
    const outcome = $derived.by(() => {
        if (session.gameCall) return undefined
        const state = session.gameState
        const [winner] = state.winningPlayerIds
        assertExists(winner, 'A finished game has a winner')
        const loser = state.opponentOf(winner)
        const loserName = session.getPlayerName(loser)
        const missing = state.missingKind(loser)
        if (missing !== undefined) {
            return { winner, reason: `${loserName} has no ${KIND_NAMES[missing]} left` }
        }
        assert(!state.canCapture(loser), 'A game is won by taking a type or leaving no capture')
        return { winner, reason: `${loserName} cannot capture` }
    })
</script>

<div class="ending">
    {#if outcome}
        <span class="winner">
            {outcome.winner === session.myPlayer?.id ? 'You win' : `${nameOf(outcome.winner)} wins`}
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
        color: var(--tzaar-ink-quiet);
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

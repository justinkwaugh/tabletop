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
        color: var(--tzaar-ink-quiet);
    }

    @media (max-width: 639px) {
        .reason {
            font-size: 13px;
        }
    }
</style>

<script lang="ts">
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { EndReason } from '@tabletop/gipf'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const winnerId = $derived(session.gameState.winningPlayerIds[0])
    const loserId = $derived(winnerId ? session.gameState.opponentOf(winnerId) : undefined)

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    const reason = $derived.by(() => {
        if (!loserId) return ''
        switch (session.gameState.endReason) {
            case EndReason.NoGipfPieces:
                return `${nameOf(loserId)} lost the last GIPF-piece`
            case EndReason.NoReserve:
                return `${nameOf(loserId)} had no piece left to bring in`
            case EndReason.Blocked:
                return `${nameOf(loserId)} had no line to push along`
            default:
                return ''
        }
    })
</script>

<div class="ending">
    {#if session.gameCall}
        <CalledGameEnding class="text-[18px] tracking-[0.02em]" />
    {:else if winnerId}
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
        color: var(--gipf-ink-quiet);
    }

    @media (max-width: 639px) {
        .reason {
            font-size: 13px;
        }
    }
</style>

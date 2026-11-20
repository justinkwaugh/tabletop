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
        color: var(--gipf-ink-quiet);
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

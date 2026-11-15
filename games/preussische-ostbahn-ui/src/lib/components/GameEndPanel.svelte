<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { isDeterminePlayerOrder } from '@tabletop/preussische-ostbahn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { END_REASONS } from '$lib/utils/describeAction.js'

    const gameSession = getGameSession()
    const reason = $derived(
        gameSession.actions.filter(isDeterminePlayerOrder).at(-1)?.metadata?.endReason
    )
    const ranking = $derived(gameSession.gameState.players.toSorted((a, b) => b.cash - a.cash))
</script>

<div class="end po-serif">
    {#if reason}<div class="reason">{END_REASONS[reason]}.</div>{/if}
    <div class="ranking">
        {#each ranking as player (player.playerId)}
            <span class="row">
                <PlayerName playerId={player.playerId} />
                <b>${player.cash}</b>
            </span>
        {/each}
    </div>
</div>

<style>
    .end {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        text-align: center;
        color: var(--po-ink);
    }

    .reason {
        font-weight: 700;
    }

    .ranking {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }

    .row {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
    }
</style>

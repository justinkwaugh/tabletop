<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { finalStandings, sharedWinNote, winnersHeadline } from '$lib/model/actionArea.js'
    import RailroadPieceIcon from '../board/RailroadPieceIcon.svelte'
    import SeatDot from './SeatDot.svelte'

    const gameSession = getGameSession()

    // R-6.2: final money in order; every seat tied for the most wins.
    const standings = $derived(finalStandings(gameSession.gameState))
    const winners = $derived(standings.filter((standing) => standing.winner))

    const headline = $derived(
        winnersHeadline(
            winners.map((winner) => gameSession.getPlayerName(winner.playerId)),
            winners[0]?.money ?? 0
        )
    )
</script>

<div class="flex flex-wrap items-baseline gap-x-3">
    <h2 class="text-base font-bold">{headline}</h2>
    {#if winners.length > 1}
        <span class="text-sm text-rtr-ink-muted">{sharedWinNote(winners.length)}</span>
    {/if}
</div>
<div class="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
    {#each standings as standing (standing.playerId)}
        <div
            class="flex min-w-0 flex-col gap-0.5 sm:min-w-36 rounded-lg border bg-rtr-panel-raised px-3 py-1.5 {standing.winner
                ? 'border-rtr-accent ring-1 ring-rtr-accent'
                : 'border-rtr-line'}"
        >
            <span class="flex items-center gap-1.5 text-sm font-semibold">
                <SeatDot playerId={standing.playerId} />
                {gameSession.getPlayerName(standing.playerId)}{standing.winner ? ' · winner' : ''}
            </span>
            <span class="rtr-display text-3xl leading-none max-sm:text-2xl">${standing.money}</span>
            <span class="flex flex-wrap items-center gap-x-2 text-xs text-rtr-ink-muted">
                {#each standing.shares as held (held.railroadId)}
                    <span class="inline-flex items-center gap-0.5">
                        <RailroadPieceIcon railroadId={held.railroadId} size={16} />×{held.count}
                    </span>
                {/each}
            </span>
        </div>
    {/each}
</div>

<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { finalStandings, sharedWinNote, winnersHeadline } from '$lib/model/actionArea.js'
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

<!-- R-6.2: the headline, then a small table of each seat's final money, most first; every seat tied
     for the most is marked as a winner. -->
<div class="flex flex-col items-center gap-1.5">
    <h2 class="flex items-center gap-2 text-xl font-bold">
        <span class="flex items-center gap-1" aria-hidden="true">
            {#each winners as winner (winner.playerId)}
                <SeatDot playerId={winner.playerId} />
            {/each}
        </span>
        {headline}
    </h2>
    {#if winners.length > 1}
        <span class="text-sm text-rtr-ink-muted">{sharedWinNote(winners.length)}</span>
    {/if}
    <table class="standings" aria-label="Final money">
        <tbody>
            {#each standings as standing, index (standing.playerId)}
                <tr class:winner={standing.winner}>
                    <td class="rank">{index + 1}</td>
                    <td class="name">
                        <span class="inline-flex items-center gap-1.5">
                            <SeatDot playerId={standing.playerId} />
                            {gameSession.getPlayerName(standing.playerId)}
                        </span>
                    </td>
                    <td class="money rtr-display">${standing.money}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .standings {
        border-collapse: collapse;
        font-size: 14px;
    }

    .standings td {
        padding: 1px 6px;
    }

    .standings tr + tr td {
        border-top: 1px solid var(--rtr-rule);
    }

    .name {
        text-align: left;
    }

    .rank {
        color: var(--rtr-ink-muted);
        text-align: right;
    }

    .money {
        font-size: 17px;
        text-align: right;
    }

    .winner .name,
    .winner .money {
        font-weight: 700;
    }
</style>

<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { ScoreView } from '$lib/model/score.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { score }: { score: ScoreView } = $props()

    const gameSession = getGameSession()
</script>

<!-- R-6.1, R-6.2, R-6.2-H1: sorted once by total; every tied leader is named. -->
<div data-score>
    <p class="mb-2 text-[15px]">
        <b class="font-semibold" data-score-winners>
            {#each score.winnerIds as winnerId, index (winnerId)}{#if index > 0}{index ===
                    score.winnerIds.length - 1
                        ? ' and '
                        : ', '}{/if}<PlayerName playerId={winnerId} />{/each}
            {score.winnerIds.length > 1 ? 'win' : 'wins'} with ${score.winningTotal}.
        </b>
        {#if score.reason}
            <span class="ml-2 text-[13px] text-pp-muted" data-score-reason
                >{score.reason}. Each share counts at its railroad's final price.</span
            >
        {/if}
    </p>
    <div class="overflow-x-auto">
        <table class="score">
            <thead>
                <tr>
                    <th>Seat</th>
                    <th>Money</th>
                    <!-- Contract, "Phone layout": four columns; the open seat breaks the shares down. -->
                    {#each score.columns as column (column.railroadId)}
                        <th class="max-sm:hidden">{column.label}</th>
                    {/each}
                    <th>Shares</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {#each score.rows as row (row.playerId)}
                    <tr class:winner={row.winner} data-score-row={row.playerId}>
                        <td class="seat">
                            <span
                                class="swatch"
                                style:background={gameSession.colors.getPlayerUiColor(row.playerId)}
                            ></span>
                            {gameSession.getPlayerName(row.playerId)}{row.winner ? ' · wins' : ''}
                        </td>
                        <td>${row.money}</td>
                        {#each row.holdings as holding (holding.railroadId)}
                            <td class="max-sm:hidden">{holding.text}</td>
                        {/each}
                        <td>${row.shareValue}</td>
                        <td class="total">${row.total}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
    <p class="mt-1 text-xs text-pp-muted sm:hidden">
        Press a seat below for its shares at the final prices.
    </p>
</div>

<style>
    .score {
        border-collapse: collapse;
        font-size: 14px;
    }

    .score th {
        padding: 4px 14px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--pp-muted);
        text-align: right;
    }

    .score td {
        padding: 7px 14px;
        border-top: 1px solid var(--pp-line);
        text-align: right;
        white-space: nowrap;
    }

    .score th:first-child,
    .score td.seat {
        text-align: left;
    }

    .score .total {
        font-family: Oswald, sans-serif;
        font-size: 19px;
    }

    .score tr.winner td {
        color: var(--pp-accent);
        font-weight: 700;
    }

    @media (width < 40rem) {
        .score {
            width: 100%;
            font-size: 13px;
        }

        .score th {
            padding: 3px 6px;
        }

        .score td {
            padding: 5px 6px;
        }

        .score .total {
            font-size: 16px;
        }
    }

    .swatch {
        display: inline-block;
        width: 11px;
        height: 11px;
        margin-right: 6px;
        border-radius: 50%;
        border: 1px solid var(--pp-halo);
        vertical-align: -1px;
    }
</style>

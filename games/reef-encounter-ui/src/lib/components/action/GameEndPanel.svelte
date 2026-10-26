<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { coralValues } from '@tabletop/reef-encounter'
    import PolypChip from '$lib/components/PolypChip.svelte'
    import { scoreTable } from '$lib/utils/scoreTable.js'
    import { endReasonText } from '$lib/utils/statusText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const values = $derived(coralValues(state.coralTiles))
    const table = $derived(scoreTable(state.scores(), values, state.turnManager.turnOrder))
    const winners = $derived(table.rows.filter((row) => row.place === 1))
    const myId = $derived(gameSession.myPlayer?.id)
    // "You" agrees like a plural, and reads lower case mid-sentence.
    const soleWinnerIsMe = $derived(winners.length === 1 && winners[0].playerId === myId)
    const midSentence = (playerId: string) => (playerId === myId ? 'lowercase' : 'capitalize')
</script>

<p class="prompt reef-display">
    {#each winners as winner, index (winner.playerId)}
        {#if index > 0}{index === winners.length - 1 ? ' and ' : ', '}{/if}<PlayerName
            playerId={winner.playerId}
            capitalization={index > 0 ? midSentence(winner.playerId) : 'capitalize'}
        />
    {/each}
    {winners.length > 1 ? ' share the win' : soleWinnerIsMe ? ' win' : ' wins'} with {winners[0]
        ?.total} points
</p>

{#if endReasonText(state.endReason)}
    <p class="detail">{endReasonText(state.endReason)}</p>
{/if}

<div class="scroll">
    <table>
        <thead>
            <tr>
                <th scope="col" class="player">Player</th>
                {#each table.rows[0]?.cells ?? [] as cell (cell.color)}
                    <th scope="col" class="color">
                        <span class="value">
                            <PolypChip color={cell.color} count={1} />
                            <span class="reef-display">×{values[cell.color]}</span>
                        </span>
                    </th>
                {/each}
                <th scope="col" class="total">Total</th>
            </tr>
        </thead>
        <tbody>
            {#each table.rows as row (row.playerId)}
                <tr class:winner={row.place === 1}>
                    <th scope="row" class="player">
                        <span class="place reef-display">{row.place}</span>
                        <PlayerName playerId={row.playerId} />
                    </th>
                    {#each row.cells as cell (cell.color)}
                        <td>
                            {#if cell.polyps > 0}
                                <span class="points reef-display">{cell.points}</span>
                                <span class="count"
                                    >{cell.polyps} polyp{cell.polyps === 1 ? '' : 's'}</span
                                >
                            {:else}
                                <span class="none">–</span>
                            {/if}
                        </td>
                    {/each}
                    <td class="total reef-display">{row.total}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

{#each table.tieBreaks as tie (tie.behindId)}
    <p class="detail">
        <PlayerName playerId={tie.aheadId} />
        {tie.aheadId === myId ? 'place' : 'places'} ahead of
        <PlayerName playerId={tie.behindId} capitalization={midSentence(tie.behindId)} /> on
        {tie.criterion}, {tie.ahead} to {tie.behind}.
    </p>
{/each}

<style>
    .scroll {
        overflow-x: auto;
        margin-top: 8px;
    }

    table {
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
        width: 100%;
        max-width: 640px;
    }

    th,
    td {
        padding: 4px 8px;
        text-align: center;
        border-bottom: 1px solid var(--reef-rule);
    }

    thead th {
        font-weight: normal;
        font-size: 13px;
        color: var(--reef-muted);
    }

    .player {
        text-align: left;
        white-space: nowrap;
    }

    .value {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: var(--reef-ink);
    }

    /* A narrow column would otherwise shrink the chip to a dot. */
    .value :global(img) {
        flex: none;
        max-width: none;
        width: 26px;
        height: 26px;
    }

    .place {
        display: inline-block;
        width: 1.2em;
        color: var(--reef-muted);
    }

    .points {
        display: block;
        font-size: 17px;
    }

    .count {
        display: block;
        font-size: 11px;
        color: var(--reef-muted);
    }

    .none {
        color: var(--reef-rule);
    }

    .total {
        font-size: 19px;
    }

    tr.winner .total {
        color: var(--reef-coral-deep);
    }

    @media (max-width: 639px) {
        th,
        td {
            padding: 3px 4px;
        }

        .count {
            display: none;
        }

        .value {
            flex-direction: column;
        }

        .value :global(img) {
            width: 22px;
            height: 22px;
        }
    }
</style>

<script lang="ts">
    import { RAILROADS, type RailroadId } from '@tabletop/promontory-point'
    import { seatLedger } from '$lib/model/seatLedger.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import { railroadColour, railroadInk } from '$lib/utils/railroadPalette.js'
    import MoneyChange from './MoneyChange.svelte'

    const gameSession = getGameSession()

    // Contract, "Seat ledger": one row per seat in seat order (R-2.1), from the displayed state.
    const ledger = $derived(seatLedger(gameSession.gameState, gameSession.myPlayer?.id))

    // While a transition plays, a share count shows what has landed (Pattern C).
    function shownCount(playerId: string, railroadId: RailroadId, count: number) {
        return gameSession.flights.seatShareCount(playerId, railroadId) ?? count
    }
</script>

{#snippet railroadTag(railroadId: RailroadId)}
    <span
        class="rr"
        style:background={railroadColour(railroadId)}
        style:color={railroadInk(railroadId)}
        data-railroad-tag={railroadId}>{RAILROAD_TAGS[railroadId]}</span
    >
{/snippet}

<!-- O-10: the brokerage ledger, one table for the whole table: shares by railroad at today's
     price, cash and score; ★ on the seat ahead; the seat the state asks to decide in amber. -->
<div class="ledger" data-seat-ledger>
    <table>
        <caption class="sr-only">Seats: shares, cash and score at today's prices</caption>
        <thead>
            <tr>
                <th scope="col" class="seat-head">Seat</th>
                {#each ledger.columns as column (column.railroadId)}
                    <th
                        scope="col"
                        class="num"
                        data-ledger-column={column.railroadId}
                        data-price={column.price}
                    >
                        {@render railroadTag(column.railroadId)}
                        <span class="price">${column.price}</span>
                    </th>
                {/each}
                <th scope="col" class="num">Cash</th>
                <th scope="col" class="num">Score</th>
            </tr>
        </thead>
        <tbody>
            {#each ledger.rows as row (row.playerId)}
                {@const name = gameSession.getPlayerName(row.playerId)}
                <tr
                    class:active={row.active}
                    class:waiting={row.waitingTurn}
                    data-ledger-row={row.playerId}
                    data-active={row.active}
                    data-leader={row.leader}
                    data-waiting-turn={row.waitingTurn}
                >
                    <th scope="row" class="seat">
                        <!-- A press on the row opens the seat over the table (contract, "Open seat"). -->
                        <button
                            type="button"
                            class="open"
                            data-ledger-seat
                            aria-expanded={gameSession.openSeat.playerId === row.playerId}
                            aria-label="Open {name}'s seat"
                            onclick={() => gameSession.openSeat.toggle(row.playerId)}
                        >
                            <span
                                class="dot"
                                aria-hidden="true"
                                style:background={gameSession.colors.getPlayerUiColor(row.playerId)}
                            ></span>
                            <span class="name">{name}</span>
                        </button>
                        {#if row.tag}
                            <span class="sr-only" data-seat-tag={row.tag}>{row.tag}</span>
                        {/if}
                        {#if row.revealedHand && row.revealedHand.length > 0}
                            <!-- R-2.2 step 1: the turn player's pieces, face up for every seat. -->
                            <span class="tags" data-ledger-hand>
                                <span class="what">hand</span>
                                {#each row.revealedHand as railroadId, index (index)}
                                    {@render railroadTag(railroadId)}
                                {/each}
                            </span>
                        {/if}
                        {#if row.keptPiece}
                            <!-- R-6.3-H2: the variant's kept piece, face up for every seat. -->
                            <span class="tags" data-ledger-kept={row.keptPiece}>
                                <span class="what">keeps</span>
                                {@render railroadTag(row.keptPiece)}
                            </span>
                        {/if}
                    </th>
                    {#each row.cells as cell (cell.railroadId)}
                        {@const count = shownCount(row.playerId, cell.railroadId, cell.count)}
                        <td
                            class="num"
                            data-ledger-share={cell.railroadId}
                            data-count={count}
                            aria-label="{count} {RAILROADS[cell.railroadId].name} {count === 1
                                ? 'share'
                                : 'shares'}, worth ${cell.worth}"
                        >
                            {#if count === 0}
                                <span class="none">–</span>
                            {:else}
                                <span class="count">{count}</span>
                                <span class="worth" data-ledger-worth={cell.worth}
                                    >${cell.worth}</span
                                >
                            {/if}
                        </td>
                    {/each}
                    <!-- R-1.3-H1: money is public. -->
                    <td class="num cash" data-seat-money={row.money}
                        >${row.money}<MoneyChange playerId={row.playerId} /></td
                    >
                    <td class="num score" data-ledger-score={row.score}>
                        {#if row.leader}<span class="star" aria-label="leads">★</span
                            >{/if}${row.score}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .ledger {
        --u: 0.7px;
        background: var(--pp-paper);
        color: var(--pp-ink);
        border-radius: 4px;
        padding: 6px 6px 4px;
        box-shadow: 0 2px 0 color-mix(in srgb, var(--pp-halo) 35%, transparent);
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        line-height: 1.15;
    }

    th,
    td {
        padding: 4px 3px;
        vertical-align: middle;
    }

    thead th {
        font-family: Oswald, sans-serif;
        font-weight: 500;
        font-size: 12px;
        color: var(--pp-ink-sub);
        border-bottom: 2px solid var(--pp-ink);
        vertical-align: bottom;
    }

    .seat-head {
        text-align: left;
    }

    .num {
        text-align: center;
    }

    thead .num {
        line-height: 1.3;
    }

    .price {
        display: block;
        color: var(--pp-ink);
    }

    tbody tr {
        position: relative;
        border-bottom: 1px solid color-mix(in srgb, var(--pp-ink) 22%, transparent);
    }

    tbody tr:last-child {
        border-bottom: 0;
    }

    /* R-X.1: the seat the state asks to decide, in amber. */
    tbody tr.active {
        background: color-mix(in srgb, var(--pp-accent) 32%, var(--pp-paper));
    }

    /* R-4.3-H4: the seat whose turn waits while a debtor decides. */
    tbody tr.waiting {
        outline: 2px dashed var(--pp-decided);
        outline-offset: -2px;
    }

    .seat {
        text-align: left;
        font-weight: 400;
    }

    .open {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: 14px;
        color: var(--pp-ink);
        text-align: left;
    }

    /* The whole row takes the press that opens the seat. */
    .open::after {
        content: '';
        position: absolute;
        inset: 0;
    }

    .open:focus-visible {
        outline: none;
    }

    .open:focus-visible::after {
        outline: 2px solid var(--pp-accent);
        outline-offset: -2px;
    }

    .dot {
        flex: none;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        border: 1px solid var(--pp-ink);
    }

    .name {
        max-width: 66px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px;
        margin-top: 2px;
    }

    .what {
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        font-size: 10.5px;
        color: var(--pp-ink-sub);
        margin-right: 1px;
    }

    .rr {
        display: inline-block;
        padding: 0 3px;
        border-radius: 2px;
        font-family: Oswald, sans-serif;
        font-size: 10.5px;
        font-weight: 600;
        line-height: 1.35;
        letter-spacing: 0.03em;
    }

    .count {
        display: block;
        font-family: Oswald, sans-serif;
        font-weight: 500;
        font-size: 15px;
    }

    .worth {
        display: block;
        font-size: 10.5px;
        color: var(--pp-ink-sub);
    }

    .none {
        color: var(--pp-ink-sub);
    }

    .cash {
        font-family: Oswald, sans-serif;
        font-size: 14px;
        white-space: nowrap;
    }

    .score {
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: 16px;
        white-space: nowrap;
    }

    .star {
        margin-right: 1px;
    }
</style>

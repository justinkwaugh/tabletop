<script lang="ts">
    import { assertExists, committedBidAmount } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { companyLotDetail } from './auctionLotDetails.js'
    import AuctionBidControl from './AuctionBidControl.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import './auctionLotTable.css'
    import AuctionBidRow from './AuctionBidRow.svelte'
    import AuctionPlayers from './AuctionPlayers.svelte'
    import { auctionSummaryPlayers } from './auctionSummary.js'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.waterfall)
    const model = $derived.by(() => {
        assertExists(auction.model, 'Auction lots require a waterfall auction')
        return auction.model
    })
    const playerId = $derived(session.myPlayer?.id)
    const lots = $derived(
        auction.lots.map(({ lot, bids, award }) => ({
            ...companyLotDetail(session, lot),
            bids,
            award
        }))
    )
    const contest = $derived(auction.contest)
    const actionable = $derived(auction.ownTurn && !contest)
    const priceRows = $derived(
        auction.priceRows.map((row) => ({
            ...row,
            lots: lots.filter((lot) => row.lotIds.includes(lot.id))
        }))
    )
    const grouped = $derived(priceRows.length > 0)
    const columnCount = $derived((actionable ? 5 : 4) - (grouped ? 1 : 0))
    const stagedBid = $derived(
        actionable && auction.selection?.kind === 'bid' ? auction.selection : undefined
    )
    const selectedLot = $derived(lots.find((lot) => lot.id === stagedBid?.lotId))
    function rowHint(row: (typeof priceRows)[number]): string | undefined {
        if (contest) return row.lotIds.includes(contest.lotId) ? 'Being auctioned' : undefined
        if (row.status === 'later') return 'Bids only for now'
        if (row.unbid > 1) return 'Last one without a bid can be bought'
        return row.unbid === 1 && row.remaining === 1 ? 'Can be bought, not bid on' : undefined
    }
    function canBid(lotId: string, amount: number) {
        return auction.canAct && !!playerId && model.canBid(playerId, lotId, amount)
    }
</script>

{#snippet cash(playerId: string)}
    {@const reserved = committedBidAmount(model.commitments(), playerId)}
    <span>Available <strong>{money(model.availableCash(playerId))}</strong></span>
    {#if reserved}<span>Reserved <strong>{money(reserved)}</strong></span>{/if}
{/snippet}

{#snippet stepper(
    lotId: string,
    amount: number,
    onChange: (amount: number) => void,
    onBid: () => void,
    onPass?: () => void
)}
    <AuctionBidControl
        {money}
        inline
        {amount}
        increment={model.rules.increment}
        canBid={canBid(lotId, amount)}
        canDecrease={canBid(lotId, amount - model.rules.increment)}
        canIncrease={canBid(lotId, amount + model.rules.increment)}
        canPass={auction.canAct}
        {onChange}
        {onBid}
        {onPass}
    />
{/snippet}

{#snippet winnerMark(award: { playerId: string; price: number })}
    {@const winner = session.getPlayerName(award.playerId)}
    <span class="winner" title={`${winner} · ${money(award.price)}`}
        ><span
            class="dot"
            style:background={session.playerColorValue(award.playerId)}
            aria-hidden="true"
        ></span><span class="sr-only">{winner}</span>{money(award.price)}</span
    >
{/snippet}

{#snippet turn()}
    {#if playerId && !contest}
        <div class="turn">
            {#if !stagedBid}<div class="summary">{@render cash(playerId)}</div>{/if}
            {#if auction.ownTurn}
                <button
                    class="pass action-button"
                    disabled={!auction.canAct}
                    onclick={() => auction.pass()}>Pass</button
                >
            {/if}
        </div>
    {/if}
{/snippet}

<section class="centered-panel" aria-label="Private auction">
    <div class="layout" class:grouped>
        <table class="auction-lot-table">
            <thead
                ><tr
                    >{#if actionable}<th><span class="sr-only">Action</span></th>{/if}<th
                        >Private</th
                    ><th class="amount">Income</th>{#if !grouped}<th class="amount">Price</th
                        >{/if}<th class="bids">Bids</th></tr
                ></thead
            >
            {#if grouped}
                {#each priceRows as row (row.price)}
                    <tbody class:open={row.status === 'open'} class:sold={row.status === 'sold'}>
                        {#if row.status === 'sold'}
                            <tr class="sold-row">
                                <td colspan={columnCount}>
                                    <strong>{money(row.price)}</strong>
                                    {#each row.lots as lot (lot.id)}
                                        <span class="sold-lot"
                                            >{session.lotInitials(lot)}
                                            {#if lot.award}{@render winnerMark(
                                                    lot.award
                                                )}{/if}</span
                                        >
                                    {/each}
                                </td>
                            </tr>
                        {:else}
                            <tr class="price-row">
                                <th colspan={columnCount} scope="rowgroup">
                                    <strong>{money(row.price)}</strong>
                                    {#if rowHint(row)}<span class="hint">{rowHint(row)}</span>{/if}
                                </th>
                            </tr>
                            {#each row.lots as lot (lot.id)}{@render lotRow(lot)}{/each}
                        {/if}
                    </tbody>
                {/each}
            {:else}
                <tbody>
                    {#each lots as lot (lot.id)}{@render lotRow(lot)}{/each}
                </tbody>
            {/if}
        </table>
        {@render turn()}
    </div>
</section>

{#snippet lotRow(lot: (typeof lots)[number])}
    {@const price = lot.award?.price ?? model.price(lot.id)}
    {@const incomeStatus = session.presentation.privateStatus?.(session.gameState, lot.id)}
    <tr
        data-private-description-row
        class:selected={selectedLot?.id === lot.id || contest?.lotId === lot.id}
        class:won={!!lot.award}
    >
        {#if actionable}<td class="action">
                {#if !lot.award && selectedLot?.id !== lot.id}{#if auction.buyOnlyLotIds.includes(lot.id)}<button
                            data-description-exclude
                            aria-label={`Buy ${session.lotName(lot)}`}
                            disabled={!auction.canAct ||
                                !playerId ||
                                !model.canPurchase(playerId, lot.id)}
                            class="buy"
                            onclick={() => auction.buy(lot.id)}>Buy</button
                        >{:else}<button
                            data-description-exclude
                            aria-label={`Bid on ${session.lotName(lot)}`}
                            disabled={!canBid(lot.id, model.minimumBid(lot.id))}
                            onclick={() => auction.selectLot('bid', lot.id)}
                            >{grouped && lot.bids.length ? 'Raise' : 'Bid'}</button
                        >{/if}{/if}
            </td>{/if}
        <th scope="row"
            ><div class="identity">
                {#if lot.token}<CompanyToken appearance={lot.token} size={26} />
                {:else}<span class="private-icon" aria-hidden="true"
                        >{session.lotInitials(lot)}</span
                    >{/if}
                <PrivateDescription
                    {money}
                    phaseColors={session.presentation.phaseColors}
                    tokens={lot.cardTokens}
                    imageUrl={session.publishedCardImage(lot.id)}
                    plate={session.publishedCardPlate(lot.id)}
                    shortName={session.lotName(lot)}
                    fullName={lot.name}
                    description={lot.company.description}
                    value={lot.price}
                    income={incomeStatus ? undefined : lot.company.revenue}
                />
            </div></th
        >
        <td class="amount income"
            >{#if incomeStatus}<span class="income-status">{incomeStatus}</span>{:else}{money(
                    lot.company.revenue
                )}<small> / OR</small>{/if}</td
        >
        {#if !grouped}<td class="amount value">
                {#if price < lot.price}<s>{money(lot.price)}</s>
                {/if}{money(price)}</td
            >{/if}
        <td class="bids">
            {#if lot.award && grouped}{@render winnerMark(
                    lot.award
                )}{:else if lot.award}{@const winner = session.getPlayerName(
                    lot.award.playerId
                )}<span class="winner" title={winner}
                    ><span
                        class="dot"
                        style:background={session.playerColorValue(lot.award.playerId)}
                        aria-hidden="true"
                    ></span><span class="name">{winner}</span></span
                >{:else if lot.bids.length}<ul aria-label={`Bids on ${session.lotName(lot)}`}>
                    {#each lot.bids as bid (bid.playerId)}
                        <li
                            class:mine={bid.playerId === playerId}
                            title={`${session.getPlayerName(bid.playerId)} · ${money(bid.amount)}`}
                        >
                            <span
                                class="dot"
                                style:background={session.playerColorValue(bid.playerId)}
                                aria-hidden="true"
                            ></span><span class="sr-only"
                                >{session.getPlayerName(bid.playerId)}</span
                            >{money(bid.amount)}
                        </li>
                    {/each}
                </ul>{:else}<span class="none">—</span>{/if}
        </td>
    </tr>
    {#if stagedBid && selectedLot?.id === lot.id}
        <AuctionBidRow columns={columnCount} label="Your bid">
            {#snippet control()}
                {@render stepper(
                    lot.id,
                    stagedBid.amount,
                    (amount) => auction.setBid(amount),
                    () => auction.confirm()
                )}
            {/snippet}
            {#snippet figures()}
                {#if playerId}{@render cash(playerId)}{/if}
            {/snippet}
        </AuctionBidRow>
    {:else if contest?.lotId === lot.id}
        <AuctionBidRow columns={columnCount} label="Current auction">
            {#snippet control()}
                {#if auction.ownTurn && auction.raiseAmount !== undefined}
                    {@render stepper(
                        lot.id,
                        auction.raiseAmount,
                        (amount) => auction.setRaise(amount),
                        () => auction.raise(),
                        () => auction.pass()
                    )}
                {/if}
            {/snippet}
            {#snippet figures()}
                <span
                    >High bidder <AuctionPlayers
                        players={auctionSummaryPlayers(session, [contest.highBidderId])}
                    /></span
                >
                <span>High bid <strong>{money(contest.highBid)}</strong></span>
            {/snippet}
        </AuctionBidRow>
    {/if}
{/snippet}

<style>
    section {
        width: 100%;
        container: waterfall-lots / inline-size;
    }
    .layout {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px 36px;
    }
    table {
        flex: 0 1 560px;
        margin-inline: 0;
    }
    .grouped {
        --auction-now: var(--rail-warning, #c9a53c);
        align-items: flex-start;
    }
    .grouped table {
        border-collapse: separate;
        border-spacing: 0;
    }
    .grouped tbody {
        --group-line: var(--rail-border, #c7b8a6);
    }
    .grouped tbody.open {
        --group-line: var(--auction-now);
    }
    .grouped tbody + tbody::before {
        content: '';
        display: block;
        height: 7px;
    }
    .grouped tbody:not(.sold) > :global(tr:first-child > *) {
        border-top: 1px solid var(--group-line);
    }
    .grouped tbody:not(.sold) > :global(tr:last-child > *) {
        border-bottom: 1px solid var(--group-line);
    }
    .grouped tbody:not(.sold) > :global(tr > :first-child) {
        border-left: 1px solid var(--group-line);
    }
    .grouped tbody:not(.sold) > :global(tr > :last-child) {
        border-right: 1px solid var(--group-line);
    }
    .grouped tbody:not(.sold) > :global(tr.selected > *),
    .grouped tbody:not(.sold) > :global(tr.bid-row > *) {
        border-radius: 0;
    }
    .grouped tbody:not(.sold) > :global(tr:first-child > :first-child) {
        border-top-left-radius: 6px;
    }
    .grouped tbody:not(.sold) > :global(tr:first-child > :last-child) {
        border-top-right-radius: 6px;
    }
    .grouped tbody:not(.sold) > :global(tr:last-child > :first-child) {
        border-bottom-left-radius: 6px;
    }
    .grouped tbody:not(.sold) > :global(tr:last-child > :last-child) {
        border-bottom-right-radius: 6px;
    }
    .grouped thead th:first-child,
    .grouped tbody > tr > :first-child {
        padding-left: 8px;
    }
    .grouped tbody > tr > :last-child {
        padding-right: 8px;
    }
    .auction-lot-table .price-row th {
        padding-block: 5px;
        font-weight: 400;
    }
    .auction-lot-table .sold-row td {
        padding-block: 1px;
        color: var(--rail-muted, #887664);
    }
    .price-row strong {
        margin-right: 6px;
        font-size: 15px;
    }
    .hint {
        color: var(--rail-muted, #887664);
        font-size: 12px;
    }
    .sold-lot {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 10px;
    }
    .grouped .action button.buy,
    .grouped .action button.buy:hover:enabled {
        border-color: var(--auction-now);
        background: var(--auction-now);
        color: #1b1f24;
        font-weight: 600;
    }
    .grouped .turn {
        position: sticky;
        top: 8px;
    }
    tr.won > *,
    tr.won .income {
        color: var(--rail-muted, #887664);
    }
    .winner {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
    }
    .winner .name {
        max-width: 6.5em;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    @container waterfall-lots (min-width: 640px) {
        th.bids {
            width: 132px;
        }
    }
    .bids {
        padding-left: 20px;
    }
    .bids ul {
        display: grid;
        gap: 2px;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .bids li {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .bids li.mine {
        font-weight: 650;
    }
    .dot {
        flex-shrink: 0;
        width: 9px;
        height: 9px;
        border-radius: 50%;
    }
    .none {
        color: var(--rail-muted, #887664);
    }
    s {
        margin-right: 3px;
        color: var(--rail-muted, #887664);
        font-weight: 400;
    }
    .turn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        flex: 0 0 200px;
    }

    .summary {
        display: flex;
        flex-direction: column;
        gap: 2px;
        color: var(--rail-text, #786550);
        font-size: 12px;
        line-height: 1.3;
    }
    .pass {
        height: 32px;
        padding: 0 22px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
    }
    .pass:disabled {
        opacity: 0.35;
        cursor: default;
    }
    .pass:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: -2px;
    }
    @container waterfall-lots (max-width: 719px) {
        .layout {
            flex-direction: column;
        }
        table {
            flex: none;
        }
        .turn {
            flex-basis: auto;
            align-items: center;
            text-align: center;
        }
        .summary {
            align-items: center;
        }
        .grouped {
            align-items: stretch;
        }
        .grouped .turn {
            top: auto;
            bottom: 0;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            padding: 8px;
            background: var(--rail-surface, #faf7f1);
        }
        .grouped .summary {
            flex-direction: row;
            gap: 12px;
        }
    }
    @container waterfall-lots (max-width: 420px) {
        .income small {
            display: none;
        }
        .income-status {
            white-space: normal;
        }
        .bids {
            padding-left: 8px;
        }
        .winner .name {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip-path: inset(50%);
        }
    }
</style>

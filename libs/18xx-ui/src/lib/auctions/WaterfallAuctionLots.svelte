<script lang="ts">
    import { assertExists, committedBidAmount } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { privateLotDetail } from './auctionLotDetails.js'
    import AuctionBidControl from './AuctionBidControl.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import './auctionLotTable.css'
    import AuctionBidRow from './AuctionBidRow.svelte'

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
            ...privateLotDetail(session, lot),
            bids,
            award
        }))
    )
    const contest = $derived(auction.contest)
    const actionable = $derived(auction.ownTurn && !contest)
    const columnCount = $derived(actionable ? 5 : 4)
    const stagedBid = $derived(
        actionable && auction.selection?.kind === 'bid' ? auction.selection : undefined
    )
    const selectedLot = $derived(lots.find((lot) => lot.id === stagedBid?.lotId))
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
    <div class="layout">
        <table class="auction-lot-table">
            <thead
                ><tr
                    >{#if actionable}<th><span class="sr-only">Action</span></th>{/if}<th
                        >Private</th
                    ><th class="amount">Income</th><th class="amount">Price</th><th class="bids"
                        >Bids</th
                    ></tr
                ></thead
            >
            <tbody>
                {#each lots as lot (lot.id)}
                    {@const price = lot.award?.price ?? model.price(lot.id)}
                    <tr
                        data-private-description-row
                        class:selected={selectedLot?.id === lot.id || contest?.lotId === lot.id}
                        class:won={!!lot.award}
                    >
                        {#if actionable}<td class="action">
                                {#if !lot.award && selectedLot?.id !== lot.id}{#if lot.id === auction.openLotId}<button
                                            data-description-exclude
                                            aria-label={`Buy ${session.lotName(lot)}`}
                                            disabled={!auction.canAct ||
                                                !playerId ||
                                                !model.canPurchase(playerId, lot.id)}
                                            onclick={() => auction.buy(lot.id)}>Buy</button
                                        >{:else}<button
                                            data-description-exclude
                                            aria-label={`Bid on ${session.lotName(lot)}`}
                                            disabled={!canBid(lot.id, model.minimumBid(lot.id))}
                                            onclick={() => auction.selectLot('bid', lot.id)}
                                            >Bid</button
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
                                    income={lot.company.revenue}
                                />
                            </div></th
                        >
                        <td class="amount income"
                            >{money(lot.company.revenue)}<small> / OR</small></td
                        >
                        <td class="amount value">
                            {#if price < lot.price}<s>{money(lot.price)}</s>
                            {/if}{money(price)}</td
                        >
                        <td class="bids">
                            {#if lot.award}{@const winner = session.getPlayerName(
                                    lot.award.playerId
                                )}<span class="winner" title={winner}
                                    ><span
                                        class="dot"
                                        style:background={session.colors.getPlayerBgColorValue(
                                            lot.award.playerId
                                        )}
                                        aria-hidden="true"
                                    ></span><span class="name">{winner}</span></span
                                >{:else if lot.bids.length}<ul
                                    aria-label={`Bids on ${session.lotName(lot)}`}
                                >
                                    {#each lot.bids as bid (bid.playerId)}
                                        <li
                                            class:mine={bid.playerId === playerId}
                                            title={`${session.getPlayerName(bid.playerId)} · ${money(bid.amount)}`}
                                        >
                                            <span
                                                class="dot"
                                                style:background={session.colors.getPlayerBgColorValue(
                                                    bid.playerId
                                                )}
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
                                    >High bidder <strong
                                        >{session.getPlayerName(contest.highBidderId)}</strong
                                    ></span
                                >
                                <span>High bid <strong>{money(contest.highBid)}</strong></span>
                            {/snippet}
                        </AuctionBidRow>
                    {/if}
                {/each}
            </tbody>
        </table>
        {@render turn()}
    </div>
</section>

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
    }
    @container waterfall-lots (max-width: 420px) {
        .income small {
            display: none;
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

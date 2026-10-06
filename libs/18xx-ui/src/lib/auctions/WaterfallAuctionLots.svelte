<script lang="ts">
    import { assertExists, committedBidAmount } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { privateLotDetail } from './auctionLotDetails.js'
    import AuctionBidControl from './AuctionBidControl.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import './auctionLotTable.css'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.waterfall)
    const model = $derived.by(() => {
        assertExists(auction.model, 'Auction lots require a waterfall auction')
        return auction.model
    })
    const playerId = $derived(session.myPlayer?.id)
    const lots = $derived(
        auction.remainingLots.map(({ lot, bids }) => ({ ...privateLotDetail(session, lot), bids }))
    )
    const stagedBid = $derived(auction.selection?.kind === 'bid' ? auction.selection : undefined)
    const selectedLot = $derived(lots.find((lot) => lot.id === stagedBid?.lotId))
    function canBid(lotId: string, amount: number) {
        return auction.canAct && !!playerId && model.canBid(playerId, lotId, amount)
    }
</script>

<section class="centered-panel" aria-label="Private auction">
    <div class="layout">
        <table class="auction-lot-table">
            <thead
                ><tr
                    ><th><span class="sr-only">Action</span></th><th>Private</th><th class="amount"
                        >Income</th
                    ><th class="bids">Bids</th><th class="amount">Price</th></tr
                ></thead
            >
            <tbody>
                {#each lots as lot, index (lot.id)}
                    <tr data-private-description-row class:selected={selectedLot?.id === lot.id}>
                        <td class="action">
                            {#if index === 0}<button
                                    data-description-exclude
                                    aria-label={`Buy ${lot.name}`}
                                    disabled={!auction.canAct ||
                                        !playerId ||
                                        !model.canPurchase(playerId, lot.id)}
                                    onclick={() => auction.buy(lot.id)}>Buy</button
                                >{:else}<button
                                    data-description-exclude
                                    aria-label={`Bid on ${lot.name}`}
                                    aria-pressed={selectedLot?.id === lot.id}
                                    disabled={!canBid(lot.id, model.minimumBid(lot.id))}
                                    onclick={() => auction.selectLot('bid', lot.id)}>Bid</button
                                >{/if}
                        </td>
                        <th scope="row"
                            ><div class="identity">
                                {#if lot.token}<CompanyToken appearance={lot.token} size={26} />
                                {:else}<span class="private-icon" aria-hidden="true"
                                        >{session.presentation.companyNames?.[lot.id]?.initials ??
                                            lot.id}</span
                                    >{/if}
                                <PrivateDescription
                                    {money}
                                    phaseColors={session.presentation.phaseColors}
                                    token={lot.token}
                                    imageUrl={session.publishedCardImage(lot.id)}
                                    name={lot.name}
                                    description={lot.company.description}
                                    value={lot.price}
                                    income={lot.company.privateRevenue}
                                />
                            </div></th
                        >
                        <td class="amount income"
                            >{#if lot.company.privateRevenue !== undefined}{money(
                                    lot.company.privateRevenue
                                )}<small> / OR</small>{:else}—{/if}</td
                        >
                        <td class="bids">
                            {#if lot.bids.length}<ul aria-label={`Bids on ${lot.name}`}>
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
                        <td class="amount value"
                            >{#if model.price(lot.id) !== lot.price}<s>{money(lot.price)}</s>
                            {/if}{money(model.price(lot.id))}</td
                        >
                    </tr>
                {/each}
            </tbody>
        </table>
        {#if playerId}
            {@const reserved = committedBidAmount(model.commitments(), playerId)}
            <div class="turn">
                <div class="summary">
                    <span>Available <strong>{money(model.availableCash(playerId))}</strong></span>
                    {#if reserved}<span>Reserved in bids <strong>{money(reserved)}</strong></span
                        >{/if}
                </div>
                {#if stagedBid && selectedLot}
                    <div class="summary">
                        <span>Bid on <strong>{selectedLot.name}</strong></span>
                    </div>
                    <AuctionBidControl
                        {money}
                        amount={stagedBid.amount}
                        increment={model.rules.increment}
                        canBid={canBid(selectedLot.id, stagedBid.amount)}
                        canDecrease={canBid(
                            selectedLot.id,
                            stagedBid.amount - model.rules.increment
                        )}
                        canIncrease={canBid(
                            selectedLot.id,
                            stagedBid.amount + model.rules.increment
                        )}
                        canPass={auction.canAct}
                        passLabel="Back"
                        onChange={(amount) => auction.setBid(amount)}
                        onBid={() => auction.confirm()}
                        onPass={() => auction.choice.clear()}
                    />
                {:else}
                    <button
                        class="pass action-button"
                        disabled={!auction.canAct}
                        onclick={() => auction.pass()}>Pass</button
                    >
                {/if}
            </div>
        {/if}
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
    tr.selected {
        background: var(--rail-surface-selected, #e6dccd);
    }
    tr.selected .action button {
        border-color: var(--rail-focus, #796047);
    }
    @container waterfall-lots (min-width: 640px) {
        th.bids {
            width: 132px;
        }
    }
    .bids ul {
        display: flex;
        flex-wrap: wrap;
        gap: 3px 10px;
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
</style>

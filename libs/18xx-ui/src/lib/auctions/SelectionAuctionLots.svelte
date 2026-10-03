<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import { privateLotDetail } from './auctionLotDetails.js'
    import AuctionBidControl from './AuctionBidControl.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import './auctionLotTable.css'

    let { session }: { session: EighteenXXSession } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.selectionAuction)
    const model = $derived.by(() => {
        assertExists(auction.model, 'Auction lots require a selection auction')
        return auction.model
    })
    const lotDetail = (lotId: string) => {
        const lot = model.lots.find((item) => item.id === lotId)
        assertExists(lot, 'Remaining auction lot must be known')
        return privateLotDetail(session, lot)
    }
    const lots = $derived(model.auction.remainingLotIds.map(lotDetail))
    // A title that deals its lots into tiers lists each tier that has lots left.
    const tiers = $derived(
        model.tiers
            ? model.tiers
                  .map((lotIds, index) => ({
                      label: `Tier ${index + 1}`,
                      lots: lotIds.map(lotDetail)
                  }))
                  .filter((tier) => tier.lots.length)
            : [{ label: undefined, lots }]
    )
    const selected = $derived(lots.find((lot) => lot.id === auction.selection?.lotId))
    const playerId = $derived(auction.playerId)
</script>

<section class="centered-panel" aria-label="Private auction">
    <div class="layout">
        <table class="auction-lot-table">
            <thead
                ><tr
                    ><th><span class="sr-only">Action</span></th><th>Private</th><th class="amount"
                        >Value</th
                    ><th class="amount">Opening bid</th></tr
                ></thead
            >
            {#each tiers as tier (tier.label)}<tbody>
                    {#if tier.label}<tr class="tier"
                            ><th colspan="4" scope="rowgroup">{tier.label}</th></tr
                        >{/if}
                    {#each tier.lots as lot (lot.id)}
                        <tr data-private-description-row class:selected={selected?.id === lot.id}>
                            <td class="action">
                                <button
                                    data-description-exclude
                                    aria-label={`Auction ${lot.name}`}
                                    aria-pressed={selected?.id === lot.id}
                                    disabled={!auction.canNominate(
                                        lot.id,
                                        model.minimumBid(lot.id)
                                    )}
                                    onclick={() => auction.select(lot.id)}>Auction</button
                                >
                            </td>
                            <th scope="row"
                                ><div class="identity">
                                    {#if lot.token}<CompanyToken appearance={lot.token} size={26} />
                                    {:else}<span class="private-icon" aria-hidden="true"
                                            >{session.presentation.companyNames?.[lot.id]
                                                ?.initials ?? lot.id}</span
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
                            <td class="amount value">{money(lot.price)}</td>
                            <td class="amount">{money(model.minimumBid(lot.id))}</td>
                        </tr>
                    {/each}
                </tbody>{/each}
        </table>
        {#if playerId}
            <div class="turn">
                <div class="summary">
                    <span
                        >{session.getPlayerName(playerId)} has
                        <strong>{money(model.cash(playerId))}</strong></span
                    >
                </div>
                {#if selected && auction.selection}
                    <div class="summary">
                        <span>Auction <strong>{selected.name}</strong></span>
                    </div>
                    <AuctionBidControl
                        {money}
                        amount={auction.selection.amount}
                        increment={model.rules.increment}
                        canBid={auction.canNominate(selected.id, auction.selection.amount)}
                        canDecrease={auction.canNominate(
                            selected.id,
                            auction.selection.amount - model.rules.increment
                        )}
                        canIncrease={auction.canNominate(
                            selected.id,
                            auction.selection.amount + model.rules.increment
                        )}
                        canPass={auction.canAct}
                        passLabel="Back"
                        onChange={(amount) => auction.setBid(amount)}
                        onBid={() => auction.nominate()}
                        onPass={() => auction.choice.clear()}
                    />
                {:else if model.canPass(playerId)}
                    <button
                        class="pass action-button"
                        disabled={!auction.canPass}
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
        container: selection-lots / inline-size;
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
    tr.tier th {
        padding-top: 8px;
        font-size: 11px;
        font-weight: 600;
        text-align: left;
        color: var(--rail-text-muted, #8a7660);
    }
    tr.selected {
        background: var(--rail-surface-selected, #e6dccd);
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
    @container selection-lots (max-width: 719px) {
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

<script lang="ts">
    import { assertExists, PassableBidding } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import AuctionBiddingCard from './AuctionBiddingCard.svelte'
    import AuctionBidControl from './AuctionBidControl.svelte'
    import { privateLotDetail } from './auctionLotDetails.js'
    import SelectionAuctionTiers from './SelectionAuctionTiers.svelte'
    import PlaceText from '../places/PlaceText.svelte'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.selectionAuction)
    const model = $derived.by(() => {
        assertExists(auction.model, 'Bidding requires a selection auction')
        return auction.model
    })
    const bidding = $derived.by(() => {
        assertExists(model.auction.bidding, 'Bidding requires a nominated lot')
        return model.auction.bidding
    })
    const lot = $derived.by(() => {
        const lot = model.lots.find((item) => item.id === bidding.lotId)
        assertExists(lot, 'Bidding requires a known lot')
        return privateLotDetail(session, lot)
    })
    const high = $derived(new PassableBidding(bidding.auction))
    const amount = $derived(auction.selection?.amount ?? model.minimumBid(bidding.lotId))
    const summary = $derived([
        { label: 'Auctioned by', value: session.getPlayerName(bidding.nominatorId) },
        { label: 'High bidder', value: session.getPlayerName(high.highBidderId) },
        { label: 'High bid', value: money(high.highBid) }
    ])
    function changeBid(value: number) {
        if (!auction.selection) auction.select(bidding.lotId)
        auction.setBid(value)
    }
</script>

<!-- A pyramid of lots stays in view beside the bid on its nominated lot. -->
{#if model.tiers}
    <article class="centered-panel" aria-label="Current auction">
        <div class="layout">
            <SelectionAuctionTiers {session} />
            <div class="turn">
                <div class="summary">
                    <span>Auction <strong>{session.lotName(lot)}</strong></span>
                    {#if lot.company.description}<span class="power"
                            ><PlaceText text={lot.company.description} /></span
                        >{/if}
                </div>
                <div class="summary">
                    {#each summary as line (line.label)}
                        <span>{line.label} <strong>{line.value}</strong></span>
                    {/each}
                </div>
                {#if auction.ownTurn}
                    <AuctionBidControl
                        {money}
                        {amount}
                        increment={model.rules.increment}
                        canBid={auction.canBid(amount)}
                        canDecrease={auction.canBid(amount - model.rules.increment)}
                        canIncrease={auction.canBid(amount + model.rules.increment)}
                        canPass={auction.canPass}
                        onChange={changeBid}
                        onBid={() => auction.bid(amount)}
                        onPass={() => auction.pass()}
                    />
                {/if}
            </div>
        </div>
    </article>
{:else}
    <AuctionBiddingCard
        {session}
        lot={{
            ...lot,
            income: lot.company.revenue,
            description: lot.company.description ?? ''
        }}
        {summary}
        {amount}
        increment={model.rules.increment}
        ownTurn={auction.ownTurn}
        canBid={(value) => auction.canBid(value)}
        canPass={auction.canPass}
        onChange={changeBid}
        onBid={() => auction.bid(amount)}
        onPass={() => auction.pass()}
    />
{/if}

<style>
    article {
        width: 100%;
        container: selection-bidding / inline-size;
    }
    .layout {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px 36px;
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
    .power {
        font-size: 11px;
        line-height: 1.35;
        color: var(--rail-muted, #887969);
    }
    @container selection-bidding (max-width: 719px) {
        .layout {
            flex-direction: column;
        }
        /* Stacked, the bid comes first and the pyramid follows for reference. */
        .turn {
            order: -1;
            flex-basis: auto;
            align-items: center;
            text-align: center;
        }
        .summary {
            align-items: center;
        }
    }
</style>

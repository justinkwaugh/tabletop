<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import PrivateCard from '../privates/PrivateCard.svelte'
    import AuctionBidControl from './AuctionBidControl.svelte'
    import { auctionLotDetails } from './auctionLotDetails.js'

    let {
        session,
        lotInfo
    }: { session: EighteenXXSession; lotInfo: (id: string) => { description: string } } =
        $props()
    const money = $derived(session.presentation.money)
    const model = $derived.by(() => {
        assertExists(session.offers.model, 'Bidding requires an offer auction')
        return session.offers.model
    })
    const bidding = $derived.by(() => {
        assertExists(model.auction.bidding, 'Bidding requires an offered lot')
        return model.auction.bidding
    })
    const lot = $derived.by(() => {
        const lot = auctionLotDetails(session, [bidding.lotId])[0]
        assertExists(lot, 'Bidding requires a known lot')
        return lot
    })
    const highBidderId = $derived.by(() => {
        if (bidding.auction.highBid === undefined) return model.auction.auctioneerId
        const bidder = bidding.auction.participants.find(
            (participant) => participant.bid === bidding.auction.highBid
        )
        assertExists(bidder, 'High bid requires a bidder')
        return bidder.playerId
    })
    const amount = $derived(session.offers.selection?.amount ?? model.minimumBid)
    function canBid(amount: number) {
        return (
            session.offers.canAct &&
            !!session.myPlayer &&
            model.canBid(session.myPlayer.id, bidding.lotId, amount)
        )
    }
    function changeBid(amount: number) {
        if (!session.offers.selection) session.offers.select(bidding.lotId)
        session.offers.setBid(amount)
    }
    function bid() {
        changeBid(amount)
        void session.offers.confirm()
    }
    function pass() {
        session.offers.choice.clear()
        void session.offers.pass()
    }
</script>

<article aria-label="Current auction">
    <div class="lot">
        <PrivateCard {money} phaseColors={session.presentation.phaseColors}
            token={lot.token}
            name={lot.name}
            description={lotInfo(lot.id).description}
            value={lot.price}
            income={session.privates.companies.find((company) => company.id === lot.id)
                ?.privateRevenue}
        />
    </div>
    <div class="turn">
        <div class="bid-summary">
            <span class="value">{bidding.auction.highBid === undefined ? 'Offered by' : 'Current bidder'} <strong>{session.getPlayerName(highBidderId)}</strong></span>
            <span class="value">{bidding.auction.highBid === undefined ? 'Initial value' : 'High bid'} <strong>{money(bidding.auction.highBid ?? lot.price)}</strong></span>
        </div>
        <AuctionBidControl {money}
            {amount}
            increment={model.rules.increment}
            canBid={canBid(amount)}
            canDecrease={canBid(amount - model.rules.increment)}
            canIncrease={canBid(amount + model.rules.increment)}
            canPass={session.offers.canAct}
            onChange={changeBid}
            onBid={bid}
            onPass={pass}
        />
    </div>
</article>

<style>
    article {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px 28px;
        padding: 4px 0;
    }
    .lot {
        width: 300px;
        max-width: 100%;
    }
    .bid-summary {
        display: flex;
        flex-direction: column;
        gap: 2px;
        line-height: 1.3;
    }
    .value {
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .turn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }
</style>

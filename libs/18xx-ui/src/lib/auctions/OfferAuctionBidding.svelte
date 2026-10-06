<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import AuctionBiddingCard from './AuctionBiddingCard.svelte'
    import { auctionLotDetails } from './auctionLotDetails.js'

    let {
        session,
        lotInfo
    }: { session: EighteenXXSessionView; lotInfo: (id: string) => { description: string } } =
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

<AuctionBiddingCard
    {session}
    lot={{
        ...lot,
        income: lot.company?.privateRevenue,
        description: lotInfo(lot.id).description
    }}
    summary={bidding.auction.highBid === undefined
        ? [
              { label: 'Offered by', value: session.getPlayerName(highBidderId) },
              { label: 'Initial value', value: money(lot.price) }
          ]
        : [
              { label: 'Current bidder', value: session.getPlayerName(highBidderId) },
              { label: 'High bid', value: money(bidding.auction.highBid) }
          ]}
    {amount}
    increment={model.rules.increment}
    {canBid}
    canPass={session.offers.canAct}
    onChange={changeBid}
    onBid={bid}
    onPass={pass}
/>

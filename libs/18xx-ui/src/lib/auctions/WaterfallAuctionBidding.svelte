<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import AuctionBiddingCard from './AuctionBiddingCard.svelte'
    import { privateLotDetail } from './auctionLotDetails.js'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.waterfall)
    const model = $derived.by(() => {
        assertExists(auction.model, 'Bidding requires a waterfall auction')
        return auction.model
    })
    const bidding = $derived.by(() => {
        assertExists(model.auction.bidding, 'Bidding requires a contested lot')
        return model.auction.bidding
    })
    const lot = $derived.by(() => {
        const lot = model.lots.find((item) => item.id === bidding.lotId)
        assertExists(lot, 'Bidding requires a known lot')
        return privateLotDetail(session, lot)
    })
    const highBid = $derived.by(() => {
        assertExists(bidding.auction.highBid, 'Contested lots open with a reserved high bid')
        return bidding.auction.highBid
    })
    const highBidderId = $derived.by(() => {
        const bidder = bidding.auction.participants.find(
            (participant) => !participant.passed && participant.bid === highBid
        )
        assertExists(bidder, 'High bid requires a bidder')
        return bidder.playerId
    })
    const amount = $derived(auction.selection?.amount ?? model.minimumBid(bidding.lotId))
    function canBid(amount: number) {
        return (
            auction.canAct &&
            !!session.myPlayer &&
            model.canBid(session.myPlayer.id, bidding.lotId, amount)
        )
    }
    function changeBid(amount: number) {
        if (!auction.selection) auction.selectLot('bid', bidding.lotId)
        auction.setBid(amount)
    }
    function bid() {
        changeBid(amount)
        void auction.confirm()
    }
    function pass() {
        auction.choice.clear()
        void auction.pass()
    }
</script>

<AuctionBiddingCard
    {session}
    lot={{
        ...lot,
        income: lot.company.privateRevenue,
        description: lot.company.description
    }}
    summary={[
        { label: 'High bidder', value: session.getPlayerName(highBidderId) },
        { label: 'High bid', value: money(highBid) }
    ]}
    {amount}
    increment={model.rules.increment}
    {canBid}
    canPass={auction.canAct}
    onChange={changeBid}
    onBid={bid}
    onPass={pass}
/>

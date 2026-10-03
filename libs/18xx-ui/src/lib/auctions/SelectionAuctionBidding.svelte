<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { PassableBidding } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import AuctionBiddingCard from './AuctionBiddingCard.svelte'
    import { privateLotDetail } from './auctionLotDetails.js'

    let { session }: { session: EighteenXXSession } = $props()
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
    function changeBid(value: number) {
        if (!auction.selection) auction.select(bidding.lotId)
        auction.setBid(value)
    }
</script>

<AuctionBiddingCard
    {session}
    lot={{
        ...lot,
        income: lot.company.privateRevenue,
        description: lot.company.description ?? ''
    }}
    summary={[
        { label: 'Auctioned by', value: session.getPlayerName(bidding.nominatorId) },
        { label: 'High bidder', value: session.getPlayerName(high.highBidderId) },
        { label: 'High bid', value: money(high.highBid) }
    ]}
    {amount}
    increment={model.rules.increment}
    canBid={(value) => auction.canBid(value)}
    canPass={auction.canPass}
    onChange={changeBid}
    onBid={() => auction.bid(amount)}
    onPass={() => auction.pass()}
/>

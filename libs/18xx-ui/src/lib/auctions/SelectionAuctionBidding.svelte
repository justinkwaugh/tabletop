<script lang="ts">
    import { assertExists, PassableBidding } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import AuctionBiddingCard from './AuctionBiddingCard.svelte'
    import AuctionBidTurn from './AuctionBidTurn.svelte'
    import AuctionLotSummary from './AuctionLotSummary.svelte'
    import AuctionTurnLayout from './AuctionTurnLayout.svelte'
    import { selectionLotDetail } from './auctionLotDetails.js'
    import SelectionAuctionTiers from './SelectionAuctionTiers.svelte'

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
    const lot = $derived(selectionLotDetail(session, bidding.lotId))
    const high = $derived(new PassableBidding(bidding.auction))
    const amount = $derived(auction.selection?.amount ?? model.minimumBid(bidding.lotId))
    const passedNames = $derived(
        bidding.auction.participants
            .filter((participant) => participant.passed)
            .map((participant) => session.getPlayerName(participant.playerId))
    )
    const summary = $derived([
        { label: 'Auctioned by', value: session.getPlayerName(bidding.nominatorId) },
        { label: 'High bidder', value: session.getPlayerName(high.highBidderId) },
        { label: 'High bid', value: money(high.highBid) },
        ...(passedNames.length ? [{ label: 'Passed', value: passedNames.join(', ') }] : [])
    ])
    function changeBid(value: number) {
        if (!auction.selection) auction.select(bidding.lotId)
        auction.setBid(value)
    }
    const bidTurn = $derived({
        summary,
        amount,
        increment: model.rules.increment,
        ownTurn: auction.ownTurn,
        canBid: (value: number) => auction.canBid(value),
        canPass: auction.canPass,
        onChange: changeBid,
        onBid: () => auction.bid(amount),
        onPass: () => auction.pass()
    })
</script>

{#if model.tiers}
    <article class="centered-panel" aria-label="Current auction">
        <AuctionTurnLayout turnFirstWhenStacked>
            {#snippet content()}
                <SelectionAuctionTiers {session} />
            {/snippet}
            {#snippet turn()}
                <AuctionLotSummary {session} {lot} />
                <AuctionBidTurn {money} {...bidTurn} />
            {/snippet}
        </AuctionTurnLayout>
    </article>
{:else}
    <AuctionBiddingCard
        {session}
        lot={{
            ...lot,
            income: lot.company.revenue,
            description: lot.company.description ?? ''
        }}
        {...bidTurn}
    />
{/if}

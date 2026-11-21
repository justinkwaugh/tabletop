<script lang="ts">
    import { assertExists, PassableBidding } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import AuctionBiddingCard from './AuctionBiddingCard.svelte'
    import AuctionBidTurn from './AuctionBidTurn.svelte'
    import LotPyramidDetail from './LotPyramidDetail.svelte'
    import SelectionAuctionPyramid from './SelectionAuctionPyramid.svelte'
    import ModalPanel from '../presentation/ModalPanel.svelte'
    import { lotSaleConsequence, pyramidLot } from './lotPyramid.js'
    import AuctionTurnLayout from './AuctionTurnLayout.svelte'
    import { selectionLotDetail } from './auctionLotDetails.js'
    import { auctionSummaryPlayers, type AuctionSummaryLine } from './auctionSummary.js'

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
    const passedIds = $derived(
        bidding.auction.participants
            .filter((participant) => participant.passed)
            .map((participant) => participant.playerId)
    )
    const summary: AuctionSummaryLine[] = $derived([
        { label: 'Auctioned by', players: auctionSummaryPlayers(session, [bidding.nominatorId]) },
        { label: 'High bidder', players: auctionSummaryPlayers(session, [high.highBidderId]) },
        { label: 'High bid', value: money(high.highBid) },
        ...(passedIds.length
            ? [{ label: 'Passed', players: auctionSummaryPlayers(session, passedIds) }]
            : [])
    ])
    function changeBid(value: number) {
        if (!auction.selection) auction.select(bidding.lotId)
        auction.setBid(value)
    }
    const tieredLot = $derived(model.tiers ? pyramidLot(model, bidding.lotId) : undefined)
    let showingPyramid = $state(false)
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

{#if tieredLot}
    <article class="centered-panel" aria-label="Current auction">
        <AuctionTurnLayout>
            {#snippet content()}
                <div class="lot">
                    <LotPyramidDetail
                        {session}
                        lot={tieredLot}
                        consequence={lotSaleConsequence(model, tieredLot, amount)}
                    />
                    <button class="show-pyramid" onclick={() => (showingPyramid = true)}
                        ><svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"
                            >{#each [[7, 2.5], [4.5, 6], [9.5, 6], [2, 9.5], [7, 9.5], [12, 9.5]] as [cx, cy] (`${cx},${cy}`)}<circle
                                    {cx}
                                    {cy}
                                    r="1.8"
                                    fill="currentColor"
                                ></circle>{/each}</svg
                        >Pyramid</button
                    >
                </div>
            {/snippet}
            {#snippet turn()}
                <AuctionBidTurn {money} {...bidTurn} />
            {/snippet}
        </AuctionTurnLayout>
        {#if showingPyramid}
            <ModalPanel
                label="Lot pyramid"
                title="Pyramid"
                closeLabel="Close pyramid"
                maxWidth="560px"
                onclose={() => (showingPyramid = false)}
            >
                <SelectionAuctionPyramid {session} />
            </ModalPanel>
        {/if}
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

<style>
    .lot {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        max-width: 26rem;
    }
    .show-pyramid {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        padding: 0 10px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514536);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }
</style>

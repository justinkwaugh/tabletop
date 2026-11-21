<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import AuctionBidControl from '../auctions/AuctionBidControl.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PlaceLink from '../places/PlaceLink.svelte'
    import AuctionPlayers from '../auctions/AuctionPlayers.svelte'
    import { auctionSummaryPlayers } from '../auctions/auctionSummary.js'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const module = $derived(session.companyAuction)
    const model = $derived.by(() => {
        assertExists(module.model, 'Company bidding requires company auctions')
        return module.model
    })
    const auction = $derived.by(() => {
        assertExists(module.auction, 'Company bidding requires an auction')
        return module.auction
    })
    const bidding = $derived.by(() => {
        assertExists(model.bidding, 'Company bidding requires bids')
        return model.bidding
    })
    const company = $derived(getCompany(session.gameState, auction.companyId))
    const startPrice = $derived(
        session.stockMarketChart.space(model.terms.startSpace(session.gameState, bidding.highBid))
            .price
    )
    const amount = $derived(module.bidAmount ?? model.minimumBid)
</script>

<article class="centered-panel" aria-label="Company auction">
    <div class="layout">
        <div class="company">
            <CompanyToken appearance={session.mapView.stations[company.id]} size={48} />
            <div>
                <strong>{session.actionCompanyName(company.id)}</strong>
                <span>Home <PlaceLink locationId={auction.home.locationId} /></span>
                {#each session.presentation.homeNotes?.(session.gameState, auction.home.locationId) ?? [] as note (note)}<span
                        class="home-note">{note}</span
                    >{/each}
            </div>
        </div>
        <div class="turn">
            <div class="summary">
                <span
                    >Auctioned by <AuctionPlayers
                        players={auctionSummaryPlayers(session, [auction.openerId])}
                    /></span
                >
                <span
                    >High bidder <AuctionPlayers
                        players={auctionSummaryPlayers(session, [bidding.highBidderId])}
                    /></span
                >
                <span
                    >High bid <strong>{money(bidding.highBid)}</strong> · starts at {money(
                        startPrice
                    )}</span
                >
                {#if module.playerId}<span
                        ><AuctionPlayers
                            players={auctionSummaryPlayers(session, [module.playerId])}
                            emphasis={false}
                        /> may bid up to
                        <strong
                            >{money(
                                model.terms.maximumBid(session.gameState, module.playerId)
                            )}</strong
                        ></span
                    >{/if}
            </div>
            <AuctionBidControl
                {money}
                {amount}
                increment={model.terms.increment}
                canBid={module.bidAllowed(amount)}
                canDecrease={module.bidAllowed(amount - model.terms.increment)}
                canIncrease={module.bidAllowed(amount + model.terms.increment)}
                canPass={module.canRespond}
                onChange={(value) => module.setBid(value)}
                onBid={() => module.bid(amount)}
                onPass={() => module.pass()}
            />
        </div>
    </div>
</article>

<style>
    .layout {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 12px 28px;
    }
    .company {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .company div,
    .summary {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .company span,
    .summary {
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .home-note {
        max-width: 18em;
    }
    .turn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }
</style>

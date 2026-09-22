<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import PrivateCard from '../privates/PrivateCard.svelte'
    import CardLightbox from '../privates/CardLightbox.svelte'
    import AuctionBidControl from './AuctionBidControl.svelte'
    import { auctionLotDetails } from './auctionLotDetails.js'

    let {
        session,
        lotInfo
    }: { session: EighteenXXSession; lotInfo: (id: string) => { description: string } } = $props()
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
    const imageUrl = $derived(session.publishedCardImage(lot.id))
    let lightbox = $state(false)
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

<article class="centered-panel" aria-label="Current auction">
    <div class="lot" class:image={!!imageUrl}>
        {#if imageUrl}
            <button
                class="card-button"
                aria-label={`Show ${lot.name} card`}
                onclick={() => {
                    lightbox = true
                }}
            >
                <PrivateCard {money} name={lot.name} description="" {imageUrl} />
            </button>
            {#if lightbox}
                <CardLightbox
                    {imageUrl}
                    name={lot.name}
                    onclose={() => {
                        lightbox = false
                    }}
                />
            {/if}
        {:else}
            <PrivateCard
                {money}
                phaseColors={session.presentation.phaseColors}
                token={lot.token}
                name={lot.name}
                description={lotInfo(lot.id).description}
                value={lot.price}
                income={session.privates.companies.find((company) => company.id === lot.id)
                    ?.privateRevenue}
            />
        {/if}
    </div>
    <div class="turn">
        <div class="bid-summary">
            <span class="value"
                >{bidding.auction.highBid === undefined ? 'Offered by' : 'Current bidder'}
                <strong>{session.getPlayerName(highBidderId)}</strong></span
            >
            <span class="value"
                >{bidding.auction.highBid === undefined ? 'Initial value' : 'High bid'}
                <strong>{money(bidding.auction.highBid ?? lot.price)}</strong></span
            >
        </div>
        <AuctionBidControl
            {money}
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
    /* Fill the action pane and contain the size so the published card can measure the pane. */
    article {
        container-type: size;
        flex: 1 1 auto;
        min-height: 196px;
    }
    .lot.image {
        width: auto;
    }
    .card-button {
        display: block;
        padding: 0;
        border: 0;
        background: none;
        cursor: zoom-in;
        border-radius: 10px;
    }
    .card-button:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 3px;
    }
    /* Published card art shrinks with the pane, with a floor so it stays legible. */
    .lot.image :global(.private-card img) {
        width: auto;
        height: clamp(180px, 100cqh - 16px, 360px);
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

<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import AuctionBidControl from '../auctions/AuctionBidControl.svelte'
    import PlaceLink from '../places/PlaceLink.svelte'

    let {
        session,
        named = true
    }: {
        session: EighteenXXSessionView
        named?: boolean
    } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.companyAuction)
    const terms = $derived(auction.model?.terms)
    const companyId = $derived(auction.selectedCompanyId)
    const home = $derived(auction.selectedHome)
    const amount = $derived(auction.openingAmount)
    const allowed = (value: number) => auction.canOpen && !auction.openingReason(value)
</script>

{#if companyId && terms}
    <div class="turn">
        <p>
            {#if named}<strong>{session.actionCompanyName(companyId)}</strong> ·{/if}
            {#if home}Home <PlaceLink locationId={home.locationId} />{:else}Choose a highlighted
                city on the map for its home{/if}
        </p>
        {#if home}{#each session.presentation.homeNotes?.(session.gameState, home.locationId) ?? [] as note (note)}<p
                    class="home-note"
                >
                    {note}
                </p>{/each}{/if}
        {#if home && amount !== undefined}
            <AuctionBidControl
                {money}
                {amount}
                increment={terms.increment}
                canBid={allowed(amount)}
                canDecrease={allowed(amount - terms.increment)}
                canIncrease={allowed(amount + terms.increment)}
                onChange={(value) => auction.setOpeningBid(value)}
                onBid={() => auction.open()}
            />
        {/if}
    </div>
{/if}

<style>
    .turn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    p {
        margin: 0;
        font-size: 13px;
        color: var(--rail-text, #514536);
    }
    .home-note {
        max-width: 30em;
        font-size: 12px;
        text-align: center;
        color: var(--rail-text, #786550);
    }
</style>

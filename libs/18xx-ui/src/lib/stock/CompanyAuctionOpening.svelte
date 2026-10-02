<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import AuctionBidControl from '../auctions/AuctionBidControl.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'

    let { session }: { session: EighteenXXSession } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.companyAuction)
    const terms = $derived(auction.model?.terms)
    const companyId = $derived(auction.selectedCompanyId)
    const home = $derived(auction.selectedHome)
    const amount = $derived(auction.openingAmount)
    const homeName = $derived(
        home ? (session.mapView.map.location(home.locationId).name ?? home.locationId) : undefined
    )
    const allowed = (value: number) => auction.canOpen && !auction.openingReason(value)
</script>

<div class="opening" aria-label="Auction a company">
    <div class="companies">
        {#each auction.companies as company (company.id)}
            <button
                class="company-choice"
                disabled={!auction.canOpen}
                aria-label={`Auction ${company.name}`}
                aria-pressed={companyId === company.id}
                data-auction-company={company.id}
                onclick={() => auction.selectCompany(company.id)}
            >
                <CompanyToken appearance={session.mapView.stations[company.id]} size={38} />
            </button>
        {/each}
    </div>
    {#if companyId && terms}
        <div class="turn">
            <p>
                <strong>{getCompany(session.gameState, companyId).name}</strong>
                {#if homeName}· Home {homeName}{:else}· Choose a highlighted city on the map for its
                    home{/if}
            </p>
            {#if home && amount !== undefined}
                <AuctionBidControl
                    {money}
                    {amount}
                    increment={terms.increment}
                    canBid={allowed(amount)}
                    canDecrease={allowed(amount - terms.increment)}
                    canIncrease={allowed(amount + terms.increment)}
                    canPass={auction.canOpen}
                    passLabel="Back"
                    onChange={(value) => auction.setOpeningBid(value)}
                    onBid={() => auction.open()}
                    onPass={() => auction.opening.back()}
                />
            {/if}
        </div>
    {/if}
</div>

<style>
    .opening {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        width: 100%;
    }
    .companies {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .company-choice {
        padding: 3px;
        border: 2px solid transparent;
        border-radius: 50%;
        background: none;
        cursor: pointer;
    }
    .company-choice[aria-pressed='true'] {
        border-color: var(--rail-focus, #796047);
    }
    .company-choice:disabled {
        opacity: 0.4;
        cursor: default;
    }
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
</style>

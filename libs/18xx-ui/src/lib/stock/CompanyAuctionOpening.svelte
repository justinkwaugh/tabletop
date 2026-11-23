<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import CompanyAuctionBid from './CompanyAuctionBid.svelte'

    let { session }: { session: EighteenXXSessionView } = $props()
    const auction = $derived(session.companyAuction)
    const companyId = $derived(auction.selectedCompanyId)
</script>

<div class="opening" aria-label="Auction a company">
    <div class="companies">
        {#each auction.companies as company (company.id)}
            <button
                class="company-choice"
                disabled={!auction.canOpen}
                aria-label={`Auction ${session.actionCompanyName(company.id)}`}
                aria-pressed={companyId === company.id}
                data-auction-company={company.id}
                onclick={() => auction.toggleCompany(company.id)}
            >
                <CompanyToken appearance={session.mapView.stations[company.id]} size={38} />
            </button>
        {/each}
    </div>
    <CompanyAuctionBid {session} />
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
</style>

<script lang="ts">
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import CompanyAuctionBid from './CompanyAuctionBid.svelte'
    import CompanyStartChoices from './CompanyStartChoices.svelte'
    import OwnerChoice from './OwnerChoice.svelte'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'

    let { session, companyId }: { session: EighteenXXSessionView; companyId: string } = $props()

    const starts = $derived(session.cardStarts)
    const kind = $derived(starts.kind(companyId))
    const buyers = $derived(starts.buyers(companyId))
</script>

<div class="heading">
    <CompanyToken appearance={session.mapView.stations[companyId]} size={24} />
    <strong>{session.companyName(companyId)}</strong>
    {#if kind === 'start' && buyers.length > 1}<span class="buyers"
            ><OwnerChoice
                {session}
                owners={buyers}
                selected={session.stock.selectedStartCompany?.buyer}
                label="Start as"
                disabled={session.busy}
                onChoose={(buyer) => starts.chooseBuyer(companyId, buyer)}
            /></span
        >{/if}
</div>
<div class="body">
    {#if kind === 'start'}<CompanyStartChoices {session} disabled={session.busy} />
    {:else if kind === 'auction'}<CompanyAuctionBid {session} named={false} />{/if}
</div>

<style>
    .heading {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }
    .buyers {
        margin-left: auto;
        padding-left: 12px;
    }
    .body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
        text-align: center;
    }
</style>

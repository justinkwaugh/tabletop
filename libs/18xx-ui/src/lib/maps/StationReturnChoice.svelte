<script lang="ts">
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const pending = $derived(session.stationReturn.prompted)
    const waiting = $derived(session.stationReturn.waiting)
    const location = $derived(
        pending ? session.mapView.map.location(pending.locationId) : undefined
    )
</script>

{#if pending && location}
    <section aria-label="Set-aside station">
        <div class="token">
            <CompanyToken appearance={session.mapView.stations[pending.companyId]} size={40} />
        </div>
        <p>Choose a city in {location.name ?? location.id} for this station.</p>
        <p>Either city may take it, even one with a station already.</p>
    </section>
{:else if waiting.length}
    <section aria-label="Set-aside stations">
        <p>
            {waiting.map((station) => session.companyName(station.companyId)).join(', ')} will place {waiting.length ===
            1
                ? 'its station'
                : 'their stations'}
            again.
        </p>
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
        text-align: center;
    }
    p {
        margin: 4px 0;
    }
    .token {
        display: flex;
        justify-content: center;
        margin-bottom: 6px;
    }
</style>

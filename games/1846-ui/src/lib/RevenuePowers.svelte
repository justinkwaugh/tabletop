<script lang="ts">
    import { draftCompany, revenueMarkerValue } from '@tabletop/1846'
    import { MapView1846 } from './mapView.js'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const state = $derived(session.gameState)
    const pending = $derived(state.pendingRevenueMarker)
    const change = $derived(session.recordedMarkerChange)
    const locationName = (id: string) => MapView1846.map.location(id).name ?? id
</script>

{#if pending || session.revenueMarkerChoices.length || state.revenueMarkers.length || change}
    <section aria-label="Revenue private powers">
        <h2>Revenue private powers</h2>
        {#if pending}
            <p>
                {pending.companyId} bought {draftCompany(pending.privateCompanyId).name}. Choose its
                marker location now, or skip this opportunity.
            </p>
        {:else if session.revenueMarkerChoices.length}
            <p>
                Place markers before running routes. Steamboat can move once each operating round;
                Meat Packing and Boomtown stay where they are first placed.
            </p>
        {/if}
        {#each session.revenueMarkerChoices as choice (`${choice.privateCompanyId}:${choice.locationId}`)}
            <button
                disabled={!session.canAssignRevenueMarker}
                onclick={() =>
                    session.assignRevenueMarker(choice.privateCompanyId, choice.locationId)}
            >
                {draftCompany(choice.privateCompanyId).name} → {locationName(choice.locationId)}
                ({choice.locationId}) · +${revenueMarkerValue(
                    choice.privateCompanyId,
                    choice.locationId
                )}
            </button>
        {/each}
        {#if pending}
            <button
                disabled={!session.canAssignRevenueMarker}
                onclick={() => session.assignRevenueMarker(pending.privateCompanyId)}
                >Skip marker placement</button
            >
        {/if}
        {#each state.revenueMarkers as marker (marker.privateCompanyId)}
            <p>
                {marker.companyId} · {draftCompany(marker.privateCompanyId).name} at
                {locationName(marker.locationId)} · +${revenueMarkerValue(
                    marker.privateCompanyId,
                    marker.locationId
                )}
                per train counting this location.
            </p>
        {/each}
        {#if change}
            <p role="status">
                {#if change.marker}
                    {change.companyId}
                    {change.previous ? 'moved' : 'placed'}
                    {draftCompany(change.marker.privateCompanyId).name}
                    {#if change.previous}from {locationName(change.previous.locationId)}{/if}
                    at {locationName(change.marker.locationId)}.
                {:else}{change.companyId} skipped marker placement.{/if}
            </p>
        {/if}
    </section>
{/if}

<style>
    section {
        background: white;
        padding: 1rem;
        margin: 1rem 0;
        border-radius: 0.4rem;
    }
    h2 {
        font-weight: 650;
        margin-bottom: 0.7rem;
    }
    p {
        margin: 0.5rem 0;
    }
    button {
        background: #16404a;
        color: white;
        border: 1px solid #667f83;
        border-radius: 0.3rem;
        padding: 0.6rem;
        margin: 0.25rem;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    button:focus-visible {
        outline: 3px solid #de9717;
    }
</style>

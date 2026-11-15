<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const stations = $derived(session.stations)
    const pending = $derived(stations.privateStation)
    const positions = $derived(stations.privateStationPositions)
</script>

{#if pending}
    {@const name = session.companyName(pending.privateCompanyId)}
    <section aria-label="Private station choice">
        <header>
            {#if positions.length === 1}
                <span>Place the {name} station for free?</span>
                <button
                    class="action-button inline-action"
                    onclick={() => stations.placePrivateStation(positions[0])}>Place</button
                >
            {:else}
                <span>Click a highlighted city to place the {name} station for free, or</span>
            {/if}
            <button
                class="action-button inline-action"
                onclick={() => stations.declinePrivateStation()}>Decline</button
            >
        </header>
    </section>
{/if}

<style>
    section {
        padding: 8px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
</style>

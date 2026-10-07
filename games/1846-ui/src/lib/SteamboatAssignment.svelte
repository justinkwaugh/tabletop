<script lang="ts">
    import { steamboatCompanies } from '@tabletop/1846'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import { MapView1846 } from './mapView.js'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const state = $derived(session.gameState)
    const chosen = $derived(session.steamboatCompanyId)
    const current = $derived(state.steamboat)
    const locationName = (id: string) => MapView1846.map.location(id).name ?? id
</script>

<section class="steamboat" aria-label="Steamboat assignment">
    <h2>Assign the Steamboat</h2>
    <p>
        {#if chosen}Choose a port on the map for {session.mapView.stations[chosen]?.label ??
                chosen}.{:else}Choose a railroad, then its port.{/if}
    </p>
    <div class="steamboat-choices" aria-label="Steamboat railroads">
        {#each steamboatCompanies(state) as companyId (companyId)}
            <button
                class="steamboat-choice"
                disabled={!session.canChooseAction}
                aria-label={`Steamboat for ${session.mapView.stations[companyId]?.label ?? companyId}`}
                aria-pressed={chosen === companyId}
                onclick={() => (session.steamboatCompanyId = companyId)}
            >
                <CompanyToken appearance={session.mapView.stations[companyId]} size={44} />
            </button>
        {/each}
    </div>
    {#if current}
        <p class="current">
            Now {session.mapView.stations[current.companyId]?.label ?? current.companyId} at
            {locationName(current.locationId)}.
        </p>
    {/if}
    <button disabled={!session.canChooseAction} onclick={() => session.assignSteamboat()}
        >Skip</button
    >
</section>

<style>
    .steamboat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    h2 {
        margin: 0;
    }
    p {
        margin: 0;
    }
    .current {
        font-size: 12px;
        color: var(--rail-muted, #887969);
    }
    .steamboat-choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    button.steamboat-choice {
        min-width: 0;
        padding: 3px;
        border-color: transparent;
        border-radius: 50%;
        background: transparent;
        transition:
            opacity 140ms ease-out,
            filter 140ms ease-out;
    }
    button.steamboat-choice:hover:not(:disabled):not([aria-pressed='true']) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button.steamboat-choice[aria-pressed='true'] {
        box-shadow: 0 0 0 2px var(--rail-focus, #8c7050);
    }
    .steamboat-choices:has([aria-pressed='true']) button.steamboat-choice[aria-pressed='false'] {
        opacity: 0.35;
        filter: grayscale(0.7);
    }
    .steamboat-choices:has([aria-pressed='true'])
        button.steamboat-choice[aria-pressed='false']:hover:not(:disabled) {
        opacity: 0.8;
        filter: none;
    }
    @media (prefers-reduced-motion: reduce) {
        button.steamboat-choice {
            transition: none;
        }
    }
</style>

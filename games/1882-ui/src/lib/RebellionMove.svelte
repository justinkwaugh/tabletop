<script lang="ts">
    import { homeStationId } from '@tabletop/18xx'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { Session1882 } from './session.svelte.js'
    import TitlePanel from './TitlePanel.svelte'
    let { session }: { session: Session1882 } = $props()
    const companyId = $derived(session.rebellionCompany)
</script>

{#if companyId}
    <TitlePanel label="North-West Rebellion">
        {#if !session.movedStationId}
            <p>
                Move one station from outside the rebellion hexes to an open city in one, free and
                without a connection; then lay or upgrade a tile there. A moved home leaves a
                neutral station.
            </p>
            <div class="choices">
                {#each session.movableStations as station (station.id)}
                    <button
                        disabled={session.busy}
                        data-station-id={station.id}
                        onclick={() => session.chooseMovedStation(station.id)}
                    >
                        <CompanyToken appearance={session.mapView.stations[companyId]} size={18} />
                        {session.stationPlace(station.id)}{station.id === homeStationId(companyId)
                            ? ' (home)'
                            : ''}
                    </button>
                {/each}
            </div>
        {:else}
            <p>
                Choose the rebellion city on the map where the station from {session.stationPlace(
                    session.movedStationId
                )} goes.
            </p>
        {/if}
    </TitlePanel>
{/if}

<style>
    button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font: inherit;
        padding: 6px 10px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface, #fffdf8);
        color: inherit;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>

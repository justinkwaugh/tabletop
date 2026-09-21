<script lang="ts">
    import EarningsDistribution from '../earnings/EarningsDistribution.svelte'
    import RouteBuilding from '../routes/RouteBuilding.svelte'
    import StationBuilding from './StationBuilding.svelte'
    import TrackBuilding from './TrackBuilding.svelte'
    import MapViewer from './MapViewer.svelte'
    import TileLibraryViewer from '../tiles/TileLibraryViewer.svelte'
    import { ClassicTileAppearance, MutedTileAppearance } from '../tiles/tileAppearance.js'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSession } = $props()
    let showTiles = $state(false)
    const historyDisabled = $derived(
        session.busy || session.updatingVisibleState || session.history.isDisabled()
    )
</script>

<section class="finance-map" aria-label="Game map">
    <header>
        <h2>Map</h2>
        <label
            >Tile style <select
                value={session.map.style}
                onchange={(event) =>
                    session.map.setStyle(
                        event.currentTarget.value === 'muted' ? 'muted' : 'classic'
                    )}
            >
                <option value="classic">Classic</option><option value="muted">Muted</option>
            </select></label
        >
        <div class="history" aria-label="Game history">
            <button
                onclick={() => session.history.goToBeginning()}
                disabled={historyDisabled || !session.history.hasPreviousAction}>Beginning</button
            >
            <button
                onclick={() => session.history.goToPreviousAction()}
                disabled={historyDisabled || !session.history.hasPreviousAction}
                >Previous action</button
            >
            <button
                onclick={() => session.history.goToNextAction()}
                disabled={historyDisabled || !session.history.hasNextAction}>Next action</button
            >
            <button
                onclick={() => session.history.goToEnd()}
                disabled={historyDisabled || !session.isViewingHistory}>Live</button
            >
        </div>
        <span role="status"
            >{session.isViewingHistory ? 'History' : 'Live'} · {session.financialState.actionCount} actions</span
        >
    </header>
    <RouteBuilding {session} />
    <EarningsDistribution {session} />
    <TrackBuilding {session} />
    <StationBuilding {session} />
    {#if !session.routes.overlays.length}
        <div class="network" aria-label="Network access">
            <label
                ><input type="checkbox" bind:checked={session.map.showTrackAccess} /> Show reachable track</label
            >
            <label
                >Company <select
                    aria-label="Network company"
                    value={session.map.networkCompanyId ?? ''}
                    onchange={(event) => session.map.inspectCompanyNetwork(event.currentTarget.value)}
                >
                    {#each session.map.networkCompanies as company}<option value={company.id}
                            >{company.name}</option
                        >{/each}
                </select></label
            >
            {#if session.map.showTrackAccess}<span
                    >Blue: reachable track{session.stations.preview ? ' (preview)' : ''}</span
                >
                {#if session.map.blockedCities.length}<span
                        >Blocked cities: {session.map.blockedCities
                            .map((city) => `${city.locationId} ${city.name ?? ''}`)
                            .join(', ')}</span
                    >{/if}
            {/if}
        </div>
    {/if}
    <MapViewer revenueStageColors={session.mapView.revenueStageColors}
        scene={session.map.displayedScene}
        maskUnavailableLocations={session.track.showChoices}
        highlightedLocationIds={session.stations.canPlace ? session.stations.locationIds : [...new Set([...session.track.reachableLocationIds, ...session.track.locationIds])]}
        legalLocationIds={session.stations.canPlace
            ? session.stations.locationIds
            : session.track.locationIds}
        routes={session.routes.displayed}
        previewLocationId={session.track.preview?.locationId ??
            session.stations.preview?.position.locationId}
        selection={session.map.selection}
        tokens={session.map.displayedTokens}
        reservations={session.track.preview?.stationReservations ??
            session.stations.displayState.stationReservations}
        appearance={session.map.style === 'muted' ? MutedTileAppearance : ClassicTileAppearance}
        onselect={(selection) => session.map.select(selection)}
    />
    <details bind:open={showTiles}>
        <summary>Available tiles</summary>
        {#if showTiles}<TileLibraryViewer
                tiles={session.mapView.tileSet.definitions}
                inventory={session.map.tileCounts}
                layouts={session.mapView.layouts}
            />{/if}
    </details>
</section>

<style>
    .finance-map {
        margin-bottom: 20px;
        padding: 16px;
        border: 1px solid var(--rail-border, #c9d2cb);
        border-radius: 7px;
        background: var(--rail-surface, #fffefa);
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    header,
    .network,
    .history {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }
    header {
        margin-bottom: 12px;
    }
    h2 {
        margin: 0 12px 0 0;
        font-size: 17px;
    }
    button,
    select {
        padding: 7px 10px;
        border: 1px solid var(--rail-border, #b5c3ba);
        border-radius: 5px;
        background: var(--rail-surface, #fffefa);
        font: inherit;
    }
    select {
        margin-right: 12px;
    }
    button,
    summary {
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    summary {
        margin: 14px 0;
    }
</style>

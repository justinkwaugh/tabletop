<script lang="ts">
    import RouteBuilding from './RouteBuilding.svelte'
    import StationBuilding from './StationBuilding.svelte'
    import TrackBuilding from './TrackBuilding.svelte'
    import MapViewer from '../maps/MapViewer.svelte'
    import TileLibraryViewer from '../tiles/TileLibraryViewer.svelte'
    import { ClassicTileAppearance, MutedTileAppearance } from '../tiles/tileAppearance.js'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
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
                value={session.mapStyle}
                onchange={(event) =>
                    session.setMapStyle(
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
    <TrackBuilding {session} />
    <StationBuilding {session} />
    {#if !session.routeOverlays.length}
        <div class="network" aria-label="Network access">
            <label
                ><input type="checkbox" bind:checked={session.showTrackAccess} /> Show reachable track</label
            >
            <label
                >Company <select
                    aria-label="Network company"
                    value={session.networkCompanyId ?? ''}
                    onchange={(event) => session.inspectCompanyNetwork(event.currentTarget.value)}
                >
                    {#each session.networkCompanies as company}<option value={company.id}
                            >{company.name}</option
                        >{/each}
                </select></label
            >
            {#if session.showTrackAccess}<span
                    >Blue: reachable track{session.stationPreview ? ' (preview)' : ''}</span
                >
                {#if session.blockedCities.length}<span
                        >Blocked cities: {session.blockedCities
                            .map((city) => `${city.locationId} ${city.name ?? ''}`)
                            .join(', ')}</span
                    >{/if}
            {/if}
        </div>
    {/if}
    <MapViewer
        scene={session.displayedMapScene}
        legalLocationIds={session.canPlaceStation
            ? session.stationLocationIds
            : session.trackLocationIds}
        routes={session.displayedRoutes}
        previewLocationId={session.trackPreview?.locationId ??
            session.stationPreview?.position.locationId}
        selection={session.mapSelection}
        tokens={session.displayedMapTokens}
        reservations={session.trackPreview?.stationReservations ??
            session.stationDisplayState.stationReservations}
        appearance={session.mapStyle === 'muted' ? MutedTileAppearance : ClassicTileAppearance}
        onselect={(selection) => {
            if (
                session.canRunTrains &&
                session.routeEditor.trainId &&
                selection.kind === 'path' &&
                session.routeEditor.extensions.some(
                    (path) =>
                        path.locationId === selection.locationId && path.pathId === selection.pathId
                )
            )
                session.appendRoutePath(selection)
            else if (
                session.canRunTrains &&
                session.routeEditor.trainId &&
                !session.routeEditor.start &&
                (selection.kind === 'node' || selection.kind === 'slot') &&
                session.routeEditor.centers.some(
                    (center) =>
                        center.locationId === selection.locationId &&
                        center.nodeId === selection.nodeId
                )
            )
                session.selectRouteStart({
                    locationId: selection.locationId,
                    nodeId: selection.nodeId
                })
            else if (
                session.canBuildTrack &&
                session.trackLocationIds.includes(selection.locationId)
            )
                session.selectTrackLocation(selection.locationId)
            else if (
                session.canPlaceStation &&
                session.stationLocationIds.includes(selection.locationId)
            ) {
                const choices = session.stationChoices.filter(
                    (choice) =>
                        choice.position.locationId === selection.locationId &&
                        (selection.kind !== 'slot' ||
                            (choice.position.nodeId === selection.nodeId &&
                                choice.position.slot === selection.slot)) &&
                        (selection.kind !== 'node' || choice.position.nodeId === selection.nodeId)
                )
                if (choices.length === 1) session.selectStationPosition(choices[0])
                else session.inspectMap(selection)
            } else session.inspectMap(selection)
        }}
    />
    <details bind:open={showTiles}>
        <summary>Available tiles</summary>
        {#if showTiles}<TileLibraryViewer
                tiles={session.mapView.tileSet.definitions}
                inventory={session.tileCounts}
                layouts={session.mapView.layouts}
            />{/if}
    </details>
</section>

<style>
    .finance-map {
        margin-bottom: 20px;
        padding: 16px;
        border: 1px solid #c9d2cb;
        border-radius: 7px;
        background: #fffefa;
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
        border: 1px solid #b5c3ba;
        border-radius: 5px;
        background: #fffefa;
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

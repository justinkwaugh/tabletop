<script lang="ts">
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
    <TrackBuilding {session} />
    <MapViewer
        scene={session.displayedMapScene}
        legalLocationIds={session.trackLocationIds}
        previewLocationId={session.trackPreview?.locationId}
        selection={session.mapSelection}
        tokens={session.displayedMapTokens}
        reservations={session.trackPreview?.stationReservations ??
            session.financialState.stationReservations}
        appearance={session.mapStyle === 'muted' ? MutedTileAppearance : ClassicTileAppearance}
        onselect={(selection) => {
            if (session.canBuildTrack && session.trackLocationIds.includes(selection.locationId))
                session.selectTrackLocation(selection.locationId)
            else session.inspectMap(selection)
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

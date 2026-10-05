<script lang="ts">
    import { ScalingWrapper } from '@tabletop/frontend-components'
    import {
        BoardInset,
        MapScene,
        StockMarketScene,
        Tile,
        TileLibraryViewer,
        mapViewport,
        viewportRect
    } from '@tabletop/18xx-ui'
    import { TrainDepot1846, TrainRules1846, EighteenFortySixTileSet } from '@tabletop/1846'
    import { BoardAreas, MapView1846, TileLayouts1846 } from './mapView.js'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const state = $derived(session.gameState)
    const viewport = $derived(
        mapViewport(session.mapScene, 140, undefined, Object.values(BoardAreas))
    )
</script>

<section aria-label="1846 board">
    <h2>Board</h2>
    <div class="board-viewport">
        <ScalingWrapper justify="center" controls="bottom-left" expandable>
            <div
                class="board"
                style:width={`${viewport.width}px`}
                style:height={`${viewport.height}px`}
            >
                <MapScene
                    scene={session.mapScene}
                    tokens={session.mapTokens}
                    routes={session.routeOverlays}
                    reservations={session.constructionMapState.stationReservations}
                    stationAppearances={MapView1846.stations}
                    hexDiameter={140}
                    extents={Object.values(BoardAreas)}
                    revenueStageColors={MapView1846.revenueStageColors}
                    legalLocationIds={session.trackLocations}
                    selection={session.selectedLocation
                        ? { kind: 'hex', locationId: session.selectedLocation }
                        : undefined}
                    onselect={session.canSelectTrack
                        ? (selection) => session.selectMap(selection)
                        : undefined}
                />
                <BoardInset label="Stock market" area={viewportRect(viewport, BoardAreas.market)}>
                    <StockMarketScene
                        market={state.stockMarket}
                        companies={state.companies}
                        appearances={MapView1846.stations}
                    />
                </BoardInset>
                <BoardInset label="Train depot" area={viewportRect(viewport, BoardAreas.depot)}>
                    <div class="depot">
                        <h3>Phase {state.phaseId}</h3>
                        <p>
                            2 operating rounds · train limit {TrainRules1846.trainLimit(state, '')}
                        </p>
                        <p>
                            2 trains · $80 · {TrainDepot1846.remaining(state.trainInventory, '2')} in
                            depot
                        </p>
                        <p>
                            3/5 · $160 or 4 · $180 · {TrainDepot1846.remaining(
                                state.trainInventory,
                                '4'
                            )} shared certificates
                        </p>
                        <p>
                            4/6 · $450 or 5 · $500 · {TrainDepot1846.remaining(
                                state.trainInventory,
                                '5'
                            )} shared certificates
                        </p>
                        <p>
                            6 · $800 or 7/8 · $900 · {TrainDepot1846.remaining(
                                state.trainInventory,
                                '6'
                            )} certificates
                        </p>
                        {#if ['III', 'IV'].includes(state.phaseId)}<p>
                                Higher offboard values and {state.phaseId === 'IV'
                                    ? 'gray'
                                    : 'brown'} upgrades are available.
                            </p>{/if}
                    </div>
                </BoardInset>
            </div>
        </ScalingWrapper>
    </div>
    {#if state.machineState === 'LayingTrack'}
        <h3>{state.trackStep?.companyId} · two yellow lays, or one yellow lay and one upgrade</h3>
        <p>
            Select a highlighted hex, then a tile and orientation. Each button commits that lay.
            Costs shown include terrain and completed hexside connections.
        </p>
        <label
            >Hex <select
                disabled={!session.canSelectTrack}
                value={session.selectedLocation ?? ''}
                onchange={(event) =>
                    session.selectMap({ kind: 'hex', locationId: event.currentTarget.value })}
            >
                <option value="">Choose a hex</option>
                {#each session.trackLocations as id (id)}<option value={id}
                        >{id} · {MapView1846.map.location(id).name ?? 'track'}</option
                    >{/each}
            </select></label
        >
        {#if session.selectedLocation}
            <button onclick={() => session.backFromTrack()}>Back</button>
            <div class="tile-choices">
                {#each session.selectedTrackChoices as choice (`${choice.definitionId}:${choice.rotation}:${JSON.stringify(choice.nodeMapping)}`)}
                    {@const tile = EighteenFortySixTileSet.definitions.find(
                        (tile) => tile.id === choice.definitionId
                    )!}
                    <button
                        disabled={!session.canSelectTrack}
                        onclick={() => session.layTrack(choice)}
                        aria-label={`Lay tile ${tile.printedNumber} at ${choice.locationId}, rotation ${choice.rotation * 60}, cost ${choice.cost}`}
                    >
                        <Tile
                            face={tile.face}
                            layout={TileLayouts1846[tile.id]}
                            printedNumber={tile.printedNumber}
                            rotation={choice.rotation}
                            orientation={MapView1846.map.definition.orientation}
                            size={110}
                        />
                        <span>#{tile.printedNumber} · {choice.rotation * 60}° · ${choice.cost}</span
                        >
                    </button>
                {/each}
            </div>
            {#if !session.selectedTrackChoices.length}<p>No legal track lay here.</p>{/if}
        {/if}
        {#if state.stationStep}
            <section aria-label="Station placement">
                <h3>Place one station · before, between, or after tile lays</h3>
                {#each session.stationChoices as choice (`${choice.position.locationId}:${choice.position.nodeId}:${choice.position.slot}`)}
                    <button
                        disabled={!session.canSelectTrack}
                        onclick={() => session.placeStation(choice)}
                    >
                        {choice.position.locationId} · {choice.position.nodeId} · slot {choice
                            .position.slot + 1} · ${choice.cost}
                    </button>
                {:else}<p>No station placement is available now.</p>{/each}
            </section>
        {/if}
        <button disabled={!session.canSelectTrack} onclick={() => session.finishTrack()}
            >{state.stationStep ? 'Finish construction' : 'Finish track'}</button
        >
    {/if}
    <details>
        <summary>Phase I–IV tile library</summary><TileLibraryViewer
            tiles={EighteenFortySixTileSet.definitions}
            layouts={TileLayouts1846}
        />
    </details>
</section>

<style>
    section {
        background: white;
        padding: 1rem;
        margin: 1rem 0;
    }
    h2,
    h3 {
        font-weight: 650;
        margin: 0.6rem 0;
    }
    .board-viewport {
        height: 580px;
        background: #cbdfe1;
        overflow: hidden;
    }
    .board {
        position: relative;
    }
    .depot {
        background: #f6f0df;
        padding: 16px;
        width: 350px;
        pointer-events: auto;
    }
    .tile-choices {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 1rem 0;
    }
    button,
    select {
        border: 1px solid #667f83;
        border-radius: 0.3rem;
        padding: 0.5rem;
        margin: 0.3rem;
        background: #eef3ef;
        color: #202c39;
    }
    button {
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    button:focus-visible,
    select:focus-visible {
        outline: 3px solid #de9717;
    }
    p {
        margin: 0.5rem 0;
    }
    details {
        margin-top: 1rem;
    }
    @media (max-width: 600px) {
        .board-viewport {
            height: 65dvh;
        }
    }
</style>

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
    import { EighteenFortySixTileSet } from '@tabletop/1846'
    import { BoardAreas, MapView1846 } from './mapView.js'
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
                    reservations={state.stationReservations}
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
                        <h3>Phase I · yellow tiles</h3>
                        <p>2 operating rounds · train limit 4</p>
                        <p>
                            2 trains · $80 · {state.trainInventory.trains.filter(
                                (train) => train.status === 'depot'
                            ).length} in depot
                        </p>
                        <p>Train buying is a later slice.</p>
                    </div>
                </BoardInset>
            </div>
        </ScalingWrapper>
    </div>
    {#if state.machineState === 'LayingTrack'}
        <h3>{state.trackStep?.companyId} · lay up to two yellow tiles</h3>
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
        <button disabled={!session.canSelectTrack} onclick={() => session.finishTrack()}
            >Finish track</button
        >
    {/if}
    <details>
        <summary>Phase I tile library</summary><TileLibraryViewer
            tiles={EighteenFortySixTileSet.definitions}
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

<script lang="ts">
    import { getCompany, cashOwnedBy } from '@tabletop/18xx'
    import Tile from '../tiles/Tile.svelte'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const turn = $derived(session.financialState.trackStep)
    const selection = $derived(session.trackSelection)
    const preview = $derived(session.trackPreview)
</script>

{#if turn}
    <section aria-label="Track construction">
        <header>
            <strong>{getCompany(session.financialState, turn.companyId).name} · Track</strong>
            <span
                >Treasury: ${cashOwnedBy(session.financialState, {
                    kind: 'company',
                    companyId: turn.companyId
                })}</span
            >
            <span>{turn.lays.length} placed</span>
            <button
                onclick={() => session.undo()}
                disabled={session.busy ||
                    session.isViewingHistory ||
                    (!selection.locationId && !session.actions.length)}>Undo</button
            >
            {#if !turn.completed}
                <button
                    onclick={() => session.finishTrack()}
                    disabled={!session.canBuildTrack || !!selection.locationId}>Finish track</button
                >
            {/if}
        </header>
        {#if turn.completed}<p>Track complete. Station placement is the next operating step.</p>
        {:else if session.isViewingHistory}<p>History view</p>
        {:else if !selection.locationId}
            <label
                >Build on <select
                    aria-label="Construction hex"
                    value=""
                    onchange={(event) => {
                        if (event.currentTarget.value)
                            session.selectTrackLocation(event.currentTarget.value)
                    }}
                    disabled={!session.canBuildTrack}
                >
                    <option value="">Select a highlighted hex</option>
                    {#each session.trackLocationIds as id}<option value={id}
                            >{id} {session.mapView.map.location(id).name ?? ''}</option
                        >{/each}
                </select></label
            >
            {#if session.canBuildTrack && !session.trackLocationIds.length}<p>
                    No legal construction is available.
                </p>{/if}
        {:else}
            <div class="selection">
                <strong>{selection.locationId.value}</strong><button
                    onclick={() => session.backTrack()}>Back</button
                >
            </div>
            {#if !selection.definitionId}
                <div class="tiles">
                    {#each session.trackTiles as tile (tile.id)}
                        <button
                            data-track-tile={tile.id}
                            aria-label={`Build tile ${tile.printedNumber}`}
                            onclick={() => session.selectTrackTile(tile.id)}
                        >
                            <Tile
                                face={tile.face}
                                printedNumber={tile.printedNumber}
                                size={80}
                                orientation={session.mapView.map.definition.orientation}
                            />
                            <span>{tile.printedNumber}</span>
                        </button>
                    {/each}
                </div>
            {:else}
                <div class="rotations" aria-label="Tile rotations">
                    {#each session.trackPlacements as choice, index}
                        <button
                            data-track-rotation={choice.rotation}
                            aria-pressed={preview?.rotation === choice.rotation &&
                                JSON.stringify(preview.nodeMapping) ===
                                    JSON.stringify(choice.nodeMapping)}
                            onclick={() => session.selectTrackPlacement(choice)}
                            >{choice.rotation *
                                60}°{#if session.trackPlacements.filter((entry) => entry.rotation === choice.rotation).length > 1}
                                · Stops {index + 1}{/if}</button
                        >
                    {/each}
                </div>
                {#if preview}<p>
                        Cost: ${preview.cost} (terrain ${preview.terrainCost}, lay ${preview.allowanceCost})
                    </p>
                    <button onclick={() => session.confirmTrack()} disabled={!session.canBuildTrack}
                        >Confirm track</button
                    >
                {:else}<p>Choose a rotation to preview.</p>{/if}
            {/if}
        {/if}
        {#if session.constructionActions.length}<ol aria-label="Construction history">
                {#each session.constructionActions as action (action.id)}
                    <li>
                        {action.locationId}: tile {session.mapView.tileSet.definitions.find(
                            (tile) => tile.id === action.definitionId
                        )?.printedNumber}, {action.rotation * 60}°, ${action.metadata?.cost ??
                            action.expectedCost}
                    </li>
                {/each}
            </ol>{/if}
    </section>
{/if}

<style>
    section {
        margin: 12px 0;
        padding: 12px;
        border: 1px solid #b5c3ba;
        border-radius: 5px;
    }
    header,
    .selection,
    .tiles,
    .rotations {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 10px;
    }
    button,
    select {
        font: inherit;
        padding: 7px 12px;
        border: 1px solid #b5c3ba;
        border-radius: 4px;
        background: #fffefa;
        cursor: pointer;
    }
    button[aria-pressed='true'] {
        outline: 2px solid #d67910;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .tiles button {
        display: grid;
        justify-items: center;
    }
    p {
        margin: 8px 0;
    }
</style>

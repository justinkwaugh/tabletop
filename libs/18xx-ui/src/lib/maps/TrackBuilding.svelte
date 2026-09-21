<script lang="ts">
    import { getCompany, cashOwnedBy } from '@tabletop/18xx'
    import { trackConsentDecline } from '../session/trackConsentNotice.js'
    import Tile from '../tiles/Tile.svelte'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        showUndo = true,
        mapControls = false
    }: { showUndo?: boolean; mapControls?: boolean; session: EighteenXXSession } = $props()
    const declined = $derived(trackConsentDecline(session.actions, session.financialState))
    const turn = $derived(session.financialState.trackStep)
    const selection = $derived(session.trackSelection)
    const preview = $derived(session.trackPreview)
</script>

{#if turn && !session.financialState.stationStep && !session.financialState.trackConsent}
    <section aria-label="Track construction">
        {#if declined}
            <p class="decline-notice" role="status">{session.getPlayerName(declined.playerId)} declined permission to lay track at {declined.metadata?.request.details.locationId}.</p>
        {/if}
        {#if mapControls}
            <header class="map-prompt">
                <span>Choose a tile space or</span>
                <button class="action-button inline-action" onclick={() => session.finishTrack()}
                    disabled={!session.canBuildTrack || !!selection.locationId}>skip</button>
            </header>
        {:else}
        <header>
            <strong>{getCompany(session.financialState, turn.companyId).name} · Track</strong>
            <span
                >Treasury: ${cashOwnedBy(session.financialState, {
                    kind: 'company',
                    companyId: turn.companyId
                })}</span
            >
            <span>{turn.lays.length} placed</span>
            {#if showUndo}<button
                    onclick={() => session.undo()}
                    disabled={session.busy ||
                        session.isViewingHistory ||
                        (!selection.locationId && !session.actions.length)}>Undo</button
                >{/if}
            {#if !turn.completed}
                <button
                    onclick={() => session.finishTrack()}
                    disabled={!session.canBuildTrack || !!selection.locationId}>Finish track</button
                >
            {/if}
        </header>
        {/if}
        {#if turn.completed}<p>Track complete.</p>
        {:else if !session.isViewingHistory && !mapControls && !selection.locationId}
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
        {:else if !session.isViewingHistory && !mapControls && selection.locationId}
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
                        >{preview.consentPlayerId &&
                        preview.consentPlayerId !== session.myPlayer?.id
                            ? 'Request track permission'
                            : 'Confirm track'}</button
                    >
                {:else}<p>Choose a rotation to preview.</p>{/if}
            {/if}
        {/if}
        {#if !mapControls && session.constructionActions.length}<ol
                aria-label="Construction history"
            >
                {#each session.constructionActions as action (action.id)}
                    <li>
                        {action.locationId}: tile {session.mapView.tileSet.definitions.find(
                            (tile) => tile.id === action.definitionId
                        )?.printedNumber}, {action.rotation * 60}°, ${action.cost}
                    </li>
                {/each}
            </ol>{/if}
    </section>
{/if}

<style>
    .decline-notice {
        width: fit-content;
        max-width: 100%;
        box-sizing: border-box;
        margin: 0 auto 10px;
        padding: 6px 12px;
        border-radius: 5px;
        background: var(--rail-surface-raised, #f2dfda);
        color: #8b352e;
        text-align: center;
        font-size: 13px;
    }
    .map-prompt { justify-content: center; margin-bottom: 0; }
    section {
        margin: 12px 0;
        padding: 12px;
        border: 1px solid var(--rail-border, #b5c3ba);
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
        border: 1px solid var(--rail-border, #b5c3ba);
        border-radius: 4px;
        background: var(--rail-surface, #fffefa);
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

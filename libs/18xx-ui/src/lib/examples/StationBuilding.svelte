<script lang="ts">
    import { getCompany, cashOwnedBy } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const step = $derived(session.financialState.stationStep)
    const selection = $derived(session.stationSelection)
    const preview = $derived(session.stationPreview)
</script>

{#if step}
    <section aria-label="Station placement">
        <header>
            <strong>{getCompany(session.financialState, step.companyId).name} · Stations</strong>
            <span
                >Treasury: ${cashOwnedBy(session.financialState, {
                    kind: 'company',
                    companyId: step.companyId
                })}</span
            >
            <span
                >{session.availableStations.length} available · {step.placedStationIds.length} placed
                this turn</span
            >
            <button
                onclick={() => session.undo()}
                disabled={session.busy ||
                    session.isViewingHistory ||
                    (!selection.stationId && !session.actions.length)}>Undo</button
            >
            {#if !step.completed}<button
                    onclick={() => session.finishStations()}
                    disabled={!session.canPlaceStation || !!selection.stationId}
                    >Finish stations</button
                >{/if}
        </header>
        {#if step.completed}<p>Station placement complete.</p>
        {:else if session.isViewingHistory}<p>History view</p>
        {:else if !selection.stationId}
            <div class="choices">
                {#each session.availableStations as station, index}
                    <button
                        data-station-id={station.id}
                        onclick={() => session.selectStation(station.id)}
                        disabled={!session.canPlaceStation ||
                            !session.validActionTypes.includes('PlaceStation')}
                        >Station {index + 1}</button
                    >
                {/each}
            </div>
            {#if session.canPlaceStation && !session.validActionTypes.includes('PlaceStation')}<p>
                    No legal station placement is available.
                </p>{/if}
        {:else}
            <div class="choices">
                <button onclick={() => session.backStation()}>Back</button>
                <label
                    >Place at <select
                        aria-label="Station position"
                        value={preview ? JSON.stringify(preview.position) : ''}
                        onchange={(event) => {
                            const choice = session.stationChoices.find(
                                (choice) =>
                                    JSON.stringify(choice.position) === event.currentTarget.value
                            )
                            if (choice) session.selectStationPosition(choice)
                        }}
                    >
                        <option value="">Select a city slot</option>
                        {#each session.stationChoices as choice}
                            <option value={JSON.stringify(choice.position)}
                                >{choice.position.locationId}
                                {session.mapView.map.location(choice.position.locationId).name ??
                                    ''} · {choice.position.nodeId} · Slot {choice.position.slot +
                                    1}</option
                            >
                        {/each}
                    </select></label
                >
            </div>
            {#if preview}<p>Cost: ${preview.cost}</p>
                <button onclick={() => session.confirmStation()} disabled={!session.canPlaceStation}
                    >Confirm station</button
                >{/if}
        {/if}
        {#if session.stationActions.length}<ol aria-label="Station history">
                {#each session.stationActions as action (action.id)}<li>
                        {action.companyId}: {action.position.locationId}, ${action.metadata?.cost ??
                            action.expectedCost}
                    </li>{/each}
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
    .choices {
        display: flex;
        gap: 10px;
        align-items: center;
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
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    p {
        margin: 8px 0;
    }
</style>

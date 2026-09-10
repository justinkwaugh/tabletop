<script lang="ts">
    import { TheOldPrinceMap } from '@tabletop/the-old-prince'
    import type { TheOldPrinceSession } from './session.svelte.js'
    let { session }: { session: TheOldPrinceSession } = $props()
    const preview = $derived(session.splitPreview?.details)
    const allocation = $derived(session.splitSelection.allocation?.value)
</script>

{#if preview && allocation}
    <div class="allocation" aria-label="Split asset allocation">
        <fieldset>
            <legend>Stations for the branch</legend>
            {#each preview.stations as { station, protectedHome }}
                <label
                    ><input
                        type="checkbox"
                        disabled={protectedHome || !session.canPreviewSplit}
                        checked={allocation.stationIds.includes(station.id)}
                        onchange={(event) => {
                            const stationIds = event.currentTarget.checked
                                ? [...allocation.stationIds, station.id]
                                : allocation.stationIds.filter((id) => id !== station.id)
                            session.setSplitAllocation({
                                ...allocation,
                                stationIds,
                                homeStationId: stationIds.includes(allocation.homeStationId)
                                    ? allocation.homeStationId
                                    : ''
                            })
                        }}
                    />
                    {TheOldPrinceMap.location(station.position.locationId).name ??
                        station.position.locationId}{protectedHome ? ' (protected home)' : ''}
                </label>
            {/each}
            <p>Choose at least one. Replaced parent pieces leave the game.</p>
        </fieldset>
        <fieldset>
            <legend>Branch home station</legend>
            {#each preview.stations.filter( (entry) => allocation.stationIds.includes(entry.station.id) ) as { station }}
                <label
                    ><input
                        type="radio"
                        name="split-home"
                        checked={allocation.homeStationId === station.id}
                        disabled={!session.canPreviewSplit}
                        onchange={() =>
                            session.setSplitAllocation({
                                ...allocation,
                                homeStationId: station.id
                            })}
                    />
                    {TheOldPrinceMap.location(station.position.locationId).name ??
                        station.position.locationId}
                </label>
            {/each}
        </fieldset>
        <fieldset>
            <legend>Trains for the branch</legend>
            {#each preview.parentTrains as train}
                <label
                    ><input
                        type="checkbox"
                        checked={allocation.trainIds.includes(train.id)}
                        disabled={!session.canPreviewSplit}
                        onchange={(event) =>
                            session.setSplitAllocation({
                                ...allocation,
                                trainIds: event.currentTarget.checked
                                    ? [...allocation.trainIds, train.id]
                                    : allocation.trainIds.filter((id) => id !== train.id)
                            })}
                    />
                    {train.definitionId} · {train.id}
                </label>
            {/each}
            {#if !preview.parentTrains.length}<p>No trains owned.</p>{/if}
            <p>
                Parent keeps {preview.parentTrains.length - allocation.trainIds.length}; branch
                receives {allocation.trainIds.length}.
            </p>
        </fieldset>
        <fieldset>
            <legend>Cash and Hunslet</legend>
            <label
                >Cash to branch <input
                    aria-label="Cash to branch"
                    type="number"
                    min="0"
                    max={preview.parentCash}
                    step="1"
                    value={allocation.cash}
                    disabled={!session.canPreviewSplit}
                    oninput={(event) =>
                        session.setSplitAllocation({
                            ...allocation,
                            cash: event.currentTarget.valueAsNumber
                        })}
                /></label
            >
            <p>
                Parent: ${preview.parentCash - allocation.cash}. Branch: ${preview.childFunding +
                    allocation.cash}, including ${preview.childFunding} from the Bank.
            </p>
            {#if preview.hunsletCertificateId}<label
                    ><input
                        type="checkbox"
                        checked={allocation.hunslet}
                        disabled={!session.canPreviewSplit}
                        onchange={(event) =>
                            session.setSplitAllocation({
                                ...allocation,
                                hunslet: event.currentTarget.checked
                            })}
                    />Transfer Hunslet to branch</label
                >{/if}
        </fieldset>
    </div>
    {#if session.splitSettlement?.reason}<p role="status">{session.splitSettlement.reason}</p>{/if}
    <button
        class="confirm"
        disabled={!session.canPreviewSplit || !session.splitSettlement?.details}
        onclick={() => session.confirmSplit()}>Confirm split</button
    >
{/if}

<style>
    .allocation {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-top: 18px;
    }
    fieldset {
        border: 1px solid #bdcbbf;
        border-radius: 6px;
        padding: 14px;
    }
    legend {
        padding: 0 6px;
        font-weight: 600;
    }
    label {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
    }
    input[type='number'] {
        padding: 8px;
        width: 100px;
        border: 1px solid #aebfb4;
        border-radius: 4px;
    }
    p {
        font-size: 14px;
        line-height: 1.5;
    }
    .confirm {
        margin-top: 14px;
        padding: 10px 16px;
        border: 1px solid #315d4f;
        border-radius: 5px;
        background: #315d4f;
        color: white;
        font: inherit;
        cursor: pointer;
    }
    :disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>

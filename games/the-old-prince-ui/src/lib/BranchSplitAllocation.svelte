<script lang="ts">
    import { TheOldPrinceMap } from '@tabletop/the-old-prince'
    import { CompanyToken, TrainBadge } from '@tabletop/18xx-ui'
    import { TheOldPrinceTrainColors } from './trainPresentation.js'
    import type { TheOldPrinceSession } from './session.svelte.js'
    let { session, onFocusLocation }: {
        session: TheOldPrinceSession
        onFocusLocation?: (locationId: string) => void
    } = $props()
    const preview = $derived(session.splitPreview?.details)
    const allocation = $derived(session.splitSelection.allocation?.value)
</script>

{#if preview && allocation}
    <div class="allocation" aria-label="Split asset allocation">
        {#each [false, true] as branch}
            {@const companyId = branch ? preview.request.branchId : preview.request.parentId}
            {@const stations = preview.stations.filter(({station}) => allocation.stationIds.includes(station.id) === branch)}
            {@const trains = preview.parentTrains.filter((train) => allocation.trainIds.includes(train.id) === branch)}
            {@const destination = branch ? 'parent' : 'branch'}
            <section class="panel" style:grid-column={branch ? 2 : 1} aria-label={branch ? 'Branch assets' : 'Parent assets'}>
                <div class="holdings">
                <header><CompanyToken appearance={session.mapView.stations[companyId]} size={28} />
                    <strong>{branch ? 'Branch' : 'Parent'}</strong></header>
                <div class="asset-section">
                    <h3>Stations</h3>
                    {#each stations as {station, protectedHome} (station.id)}
                        {@const name = TheOldPrinceMap.location(station.position.locationId).name ?? station.position.locationId}
                        <div class="asset" class:branch>
                            {#if !protectedHome}<button class="transfer" disabled={!session.canPreviewSplit}
                                aria-label={`Transfer ${name} to ${destination}`}
                                onclick={() => session.transferSplitStation(station.id)}>{branch ? '←' : '→'}</button>{/if}
                            <button class="station-name" onclick={() => onFocusLocation ? onFocusLocation(station.position.locationId) : session.inspectMap({kind:'hex',locationId:station.position.locationId})}>{name}</button>
                            {#if protectedHome}<small>Home</small>{/if}
                        </div>
                    {:else}<span class="empty">None</span>{/each}
                </div>
                {#if branch ? trains.length : preview.parentTrains.length}
                <div class="asset-section">
                    <h3>Trains</h3>
                    {#each trains as train (train.id)}
                        <div class="asset" class:branch>
                            <button class="transfer" disabled={!session.canPreviewSplit}
                                aria-label={`Transfer ${session.trainDepot.trainDefinition(train.definitionId).name} train to ${destination}`}
                                onclick={() => session.transferSplitTrain(train.id)}>{branch ? '←' : '→'}</button>
                            <TrainBadge name={session.trainDepot.trainDefinition(train.definitionId).name} color={TheOldPrinceTrainColors[train.definitionId]} />
                        </div>
                    {:else}<span class="empty">None</span>{/each}
                </div>
                {/if}
                {#if preview.hunsletCertificateId && (!branch || allocation.hunslet)}
                    <div class="asset-section">
                        <h3>Hunslet</h3>
                        {#if allocation.hunslet === branch}
                            <div class="asset" class:branch>
                                <button class="transfer" disabled={!session.canPreviewSplit}
                                    aria-label={`Transfer Hunslet to ${destination}`}
                                    onclick={() => session.setSplitAllocation({...allocation, hunslet:!allocation.hunslet})}>{branch ? '←' : '→'}</button>
                                <span>Hunslet Steam Engine</span>
                            </div>
                        {:else}<span class="empty">None</span>{/if}
                    </div>
                {/if}
                </div>
                <div class="asset-section cash-section">
                    <h3>Cash</h3>
                    {#if branch}
                        <strong class="cash-total" aria-label="Branch cash">${(preview.childFunding + allocation.cash).toLocaleString('en-US')}</strong>
                        <small>Includes ${preview.childFunding} from the bank</small>
                    {:else}
                        <label>$<input type="number" aria-label="Parent cash" min="0" max={preview.parentCash} step="1"
                            value={preview.parentCash - allocation.cash} disabled={!session.canPreviewSplit}
                            oninput={(event) => {
                                const value = event.currentTarget.valueAsNumber
                                if (Number.isFinite(value)) session.setSplitCash(preview.parentCash - value)
                            }} /></label>
                    {/if}
                </div>
            </section>
        {/each}
        <div class="cash-slider">
            <small class="slider-label">Adjust cash</small>
            <input type="range" aria-label="Cash to branch" min="0" max={preview.parentCash} step="1"
                value={allocation.cash} disabled={!session.canPreviewSplit || preview.parentCash === 0}
                oninput={(event) => session.setSplitCash(event.currentTarget.valueAsNumber)} />
        </div>
    </div>
    {#if session.splitSettlement?.reason}<p class="reason" role="status">{!allocation.stationIds.length ? 'Allocate at least one branch station' : session.splitSettlement.reason}</p>{/if}
    <button class="confirm" disabled={!session.canPreviewSplit || !session.splitSettlement?.details}
        onclick={() => session.confirmSplit()}>Confirm split</button>
{/if}

<style>
    .allocation { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); column-gap: 12px; row-gap: 0; max-width: 660px; margin: 12px auto 0; font-size: 12px; }
    .panel { display: grid; grid-row: 1 / span 2; grid-template-rows: subgrid; border: 1px solid #c7b8a6; border-radius: 7px; overflow: hidden; }
    header { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: #eee4d8; }
    header strong { font-size: 14px; font-weight: 600; }
    .asset-section { padding: 7px 10px; border-top: 1px solid #e3d9cd; }
    h3 { margin: 0 0 5px; font-size: 10px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: #786550; }
    .asset { display: flex; align-items: center; gap: 6px; min-height: 26px; }
    .asset:not(.branch) .transfer { order: 2; margin-left: auto; }
    .empty, small { font-size: 10px; color: #897866; }
    button { font: inherit; border: 0; color: inherit; background: transparent; cursor: pointer; border-radius: 4px; }
    button:hover:not(:disabled) { background: #e6d9c8; }
    button:focus-visible { outline: 2px solid #a87948; outline-offset: 1px; }
    button:disabled { opacity: .35; cursor: default; }
    .transfer { font-size: 26px; line-height: 1; padding: 3px 8px; background: #eee4d8; border-radius: 5px; }
    .station-name { text-align: left; padding: 2px 3px; }
    label { display: flex; align-items: center; gap: 3px; }
    input[type="number"] { width: 72px; padding: 3px 5px; font: inherit; background: #fffdf8; border: 1px solid #c7b8a6; border-radius: 4px; }
    .cash-section { min-height: 64px; }
    .cash-section small { display: block; margin-top: 4px; }
    .cash-total { display: block; font-size: 16px; font-weight: 600; line-height: 26px; font-variant-numeric: tabular-nums; }
    .cash-slider { grid-column: 1 / -1; padding: 12px 10px 0; }
    .slider-label { display: block; margin-bottom: 5px; text-align: center; text-transform: uppercase; letter-spacing: .07em; font-size: 9px; }
    input[type="range"] { display: block; width: 100%; margin: 0; accent-color: #695543; cursor: pointer; }
    .reason { text-align: center; font-size: 12px; }
    .confirm { display: block; margin: 10px auto 0; padding: 7px 14px; color: white; background: #443e35; }
    .confirm:hover:not(:disabled) { background: #5b5145; }
    @media(max-width: 480px) { .allocation { column-gap: 6px; } .asset-section, header { padding: 6px; } }
</style>

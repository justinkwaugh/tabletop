<script lang="ts">
    import { isObsoleteTrain } from '@tabletop/18xx'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import type { SizedCompanySessionView } from '../session/sizedCompanySession.svelte.js'
    import type { CompanyExcessModule } from '../session/sizedCompanyModules.svelte.js'
    import CompanyRoundPanel from './CompanyRoundPanel.svelte'
    let {
        session,
        excess
    }: {
        session: SizedCompanySessionView
        excess: NonNullable<CompanyExcessModule['current']>
    } = $props()
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const duplicateLocationId = $derived(
        excess.stations.find((station) =>
            excess.stations.some(
                (other) =>
                    other.id !== station.id &&
                    other.position.locationId === station.position.locationId
            )
        )?.position.locationId
    )
    const duplicateName = $derived(
        duplicateLocationId &&
            (session.mapView.map.location(duplicateLocationId).name ?? duplicateLocationId)
    )
    const markerOwners = $derived(
        valid.includes('RemoveStationMarker')
            ? excess.markers.map((marker) => session.companyName(marker.privateCompanyId))
            : []
    )
    const stationRules = $derived(session.sizedCompanies.stations)
    const markerCount = $derived(
        markerOwners.length
            ? `Over the station limit: ${stationRules.heldStations(session.gameState, excess.companyId)} stations and ${markerOwners.map((name) => `${name}’s marker`).join(' and ')} count toward ${stationRules.rules.limit}.`
            : undefined
    )
    const choosingOnMap = $derived(
        (valid.includes('RemoveStation') && excess.stations.length > 0) ||
            (valid.includes('RemoveStationMarker') && excess.markers.length > 0)
    )
</script>

<CompanyRoundPanel {session} label="Company limits" companyId={excess.companyId}>
    <p>
        {duplicateName
            ? `Keep one station in ${duplicateName}.`
            : (markerCount ??
              (excess.stations.length || excess.markers.length
                  ? 'Over the station limit.'
                  : 'Over the train limit.'))}
        {#if markerOwners.length}
            Choose a highlighted station on the map to remove, or the marker, which discards {markerOwners.join(
                ' and '
            )}.
        {:else if choosingOnMap}
            Choose a highlighted station on the map to remove.
        {/if}
    </p>
    {#if valid.includes('DiscardMergedTrain')}
        <div class="choices">
            {#each excess.trains as train (train.id)}
                <button disabled={busy} onclick={() => session.excess.discardTrain(train.id)}
                    >Discard <TrainBadge
                        name={session.trainDepot.trainDefinition(train.definitionId).name}
                        color={session.presentation.trainColors[train.definitionId]}
                        obsolete={isObsoleteTrain(train)}
                    /></button
                >
            {/each}
        </div>
    {/if}
</CompanyRoundPanel>

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
</style>

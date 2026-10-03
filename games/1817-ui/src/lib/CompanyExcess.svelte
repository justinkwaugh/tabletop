<script lang="ts">
    import { TrainBadge } from '@tabletop/18xx-ui'
    import { EighteenSeventeenMap } from '@tabletop/1817'
    import RoundPanel from './RoundPanel.svelte'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let {
        session,
        excess
    }: {
        session: EighteenSeventeenSession
        excess: NonNullable<EighteenSeventeenSession['companyExcess']>
    } = $props()
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
</script>

<RoundPanel {session} label="Company limits" companyId={excess.companyId}>
    <p>{excess.stations.length ? 'Over the station limit' : 'Over the train limit'}</p>
    {#if valid.length}
        <div class="choices">
            {#if valid.includes('RemoveStation')}
                {#each excess.stations as station (station.id)}
                    <button disabled={busy} onclick={() => session.removeStation(station.id)}
                        >Remove {EighteenSeventeenMap.location(station.position.locationId).name ??
                            station.position.locationId}</button
                    >
                {/each}
            {/if}
            {#if valid.includes('DiscardMergedTrain')}
                {#each excess.trains as train (train.id)}
                    <button disabled={busy} onclick={() => session.discardMergedTrain(train.id)}
                        >Discard <TrainBadge
                            name={session.trainDepot.trainDefinition(train.definitionId).name}
                            color={session.presentation.trainColors[train.definitionId]}
                        /></button
                    >
                {/each}
            {/if}
        </div>
    {/if}
</RoundPanel>

<script lang="ts">
    import { isObsoleteTrain } from '@tabletop/18xx'
    import { assertExists } from '@tabletop/common'
    import { privateMarkerLabel } from '../maps/mapDrawing.js'
    import TileArtwork from '../tiles/TileArtwork.svelte'
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
    const stationChoices = $derived(
        excess.stations.map((station) => {
            const hex = session.map.scene.locations.find(
                (entry) => entry.location.id === station.position.locationId
            )
            assertExists(hex, 'A station choice belongs to the map')
            const node = hex.drawing.nodes.find(
                (entry) => entry.node.id === station.position.nodeId
            )
            assertExists(node, 'A station choice belongs to a city')
            const point = node.slots[station.position.slot]
            assertExists(point, 'A station choice occupies a city slot')
            const side =
                Math.abs(node.center.y) >= Math.abs(node.center.x)
                    ? node.center.y < 0
                        ? 'upper'
                        : 'lower'
                    : node.center.x < 0
                      ? 'left'
                      : 'right'
            const city = hex.drawing.nodes.length > 1 ? `, ${side} city` : ''
            return { station, hex, point, label: `${hex.location.name ?? hex.location.id}${city}` }
        })
    )
    const markerChoices = $derived(
        excess.markers.map((marker) => {
            const hex = session.map.scene.locations.find(
                (entry) => entry.location.id === marker.locationId
            )
            assertExists(hex, 'A marker choice belongs to the map')
            return { marker, hex }
        })
    )
    const duplicateHex = $derived(
        stationChoices.find(({ station }) =>
            excess.stations.some(
                (other) =>
                    other.id !== station.id &&
                    other.position.locationId === station.position.locationId
            )
        )?.hex
    )
</script>

<CompanyRoundPanel {session} label="Company limits" companyId={excess.companyId}>
    <p>
        {duplicateHex
            ? `Keep one station in ${duplicateHex.location.name ?? duplicateHex.location.id}. Choose the placement to remove.`
            : excess.stations.length || excess.markers.length
              ? 'Over the station limit'
              : 'Over the train limit'}
    </p>
    {#if valid.length}
        <div class="choices">
            {#if valid.includes('RemoveStation')}
                {#each stationChoices as { station, hex, point, label } (station.id)}
                    <button
                        class="station-choice"
                        disabled={busy}
                        onclick={() => session.excess.removeStation(station.id)}
                    >
                        <svg width="90" height="90" viewBox="-53 -53 106 106" aria-hidden="true">
                            <TileArtwork
                                face={hex.face}
                                drawing={hex.drawing}
                                appearance={session.tileAppearance}
                            />
                            <circle
                                cx={point.x}
                                cy={point.y}
                                r="11"
                                fill="#fff"
                                stroke="#b42318"
                                stroke-width="3"
                            ></circle>
                            <path
                                d={`M ${point.x - 5} ${point.y - 5} l 10 10 M ${point.x - 5} ${point.y + 5} l 10 -10`}
                                stroke="#b42318"
                                stroke-width="2"
                            ></path>
                        </svg>
                        Remove {label}
                    </button>
                {/each}
            {/if}
            {#if valid.includes('RemoveStationMarker')}
                {#each markerChoices as { marker, hex } (`${marker.kind}:${marker.locationId}`)}
                    <button
                        class="station-choice"
                        disabled={busy}
                        onclick={() => session.excess.removeMarker(marker)}
                    >
                        <svg width="90" height="90" viewBox="-53 -53 106 106" aria-hidden="true">
                            <TileArtwork
                                face={hex.face}
                                drawing={hex.drawing}
                                appearance={session.tileAppearance}
                            />
                            <circle r="11" fill="#fff" stroke="#b42318" stroke-width="3"></circle>
                            <path
                                d="M -5 -5 l 10 10 M -5 5 l 10 -10"
                                stroke="#b42318"
                                stroke-width="2"
                            ></path>
                        </svg>
                        Remove the {privateMarkerLabel(
                            session.mapView,
                            marker.kind,
                            marker.locationId
                        )}
                    </button>
                {/each}
            {/if}
            {#if valid.includes('DiscardMergedTrain')}
                {#each excess.trains as train (train.id)}
                    <button disabled={busy} onclick={() => session.excess.discardTrain(train.id)}
                        >Discard <TrainBadge
                            name={session.trainDepot.trainDefinition(train.definitionId).name}
                            color={session.presentation.trainColors[train.definitionId]}
                            obsolete={isObsoleteTrain(train)}
                        /></button
                    >
                {/each}
            {/if}
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
    .station-choice {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface-raised, #efe7db);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .station-choice:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>

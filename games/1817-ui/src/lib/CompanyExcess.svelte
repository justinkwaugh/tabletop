<script lang="ts">
    import { TrainBadge, TileArtwork } from '@tabletop/18xx-ui'
    import { assertExists } from '@tabletop/common'
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
    const duplicateHex = $derived(
        excess.stations.some((station) =>
            excess.stations.some(
                (other) =>
                    other.id !== station.id &&
                    other.position.locationId === station.position.locationId
            )
        )
    )
</script>

<RoundPanel {session} label="Company limits" companyId={excess.companyId}>
    <p>
        {duplicateHex
            ? 'Keep one station in New York. Choose the placement to remove.'
            : excess.stations.length
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
                        onclick={() => session.removeStation(station.id)}
                    >
                        <svg width="90" height="90" viewBox="-53 -53 106 106" aria-hidden="true">
                            <TileArtwork face={hex.face} drawing={hex.drawing} />
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

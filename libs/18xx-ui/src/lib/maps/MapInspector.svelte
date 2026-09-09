<script lang="ts">
    import type { StationReservation } from '@tabletop/18xx'
    import {
        printedMapReservations,
        type MapToken,
        type MapDrawing,
        type MapSelection
    } from './mapDrawing.js'
    let {
        scene,
        selection,
        reservations,
        tokens = []
    }: {
        scene: MapDrawing
        selection?: MapSelection
        reservations?: readonly StationReservation[]
        tokens?: readonly MapToken[]
    } = $props()
    const currentReservations = $derived(reservations ?? printedMapReservations(scene))
    const entry = $derived(
        scene.locations.find((entry) => entry.location.id === selection?.locationId)
    )
</script>

<aside aria-label="Map inspection">
    {#if entry}
        <h2>{entry.location.id} {entry.location.name ?? ''}</h2>
        <p>
            {entry.placed ? 'Placed tile' : 'Preprinted tile'} · {entry.face.color} · {entry.rotation *
                60}°
        </p>
        {#if selection?.kind === 'path'}<p>Path: {selection.pathId}</p>{/if}
        {#if selection?.kind === 'node' || selection?.kind === 'slot'}<p>
                Stop: {selection.nodeId}{selection.kind === 'slot'
                    ? ` · Station space ${selection.slot + 1}`
                    : ''}
            </p>{/if}
        <p>{entry.location.buildable ? 'Construction location' : 'Fixed map track'}</p>
        {#if entry.location.terrain}
            <p>
                Printed terrain: {entry.location.terrain.kinds.join(' + ')} · {entry.location
                    .terrain.cost}{entry.placed ? ' (covered)' : ''}
            </p>
        {/if}
        {#if entry.face.upgradeCost !== undefined}<p>
                Tile upgrade cost: {entry.face.upgradeCost}
            </p>{/if}
        {#each entry.face.nodes as node (node.id)}
            {#if node.kind !== 'junction'}
                <p>
                    {node.id}: {node.kind} · {node.revenue.kind === 'fixed'
                        ? node.revenue.amount
                        : node.revenue.values
                              .map((value) => `${value.stage}: ${value.amount}`)
                              .join(' / ')}
                    {node.kind === 'city' ? ` · ${node.stationSlots} station spaces` : ''}
                </p>
            {/if}
        {/each}
        {#each tokens.filter((token) => token.locationId === entry.location.id) as token}<p>
                Station: {token.label} · {token.nodeId} · Space {token.slot + 1}
            </p>{/each}
        {#each currentReservations.filter((reservation) => reservation.locationId === entry.location.id) as reservation}<p
            >
                Home reservation: {reservation.companyId} · {reservation.nodeId}
            </p>{/each}
        {#each entry.location.upgradeLabels ?? [] as label}<p>
                Upgrade label: {label.label} from {label.color}
            </p>{/each}
        {#each entry.location.markers ?? [] as marker (marker.id)}<p>
                <strong>{marker.label}:</strong>
                {marker.description}
            </p>{/each}
        {#each entry.location.borders ?? [] as border}<p>
                Edge {border.edge}: {border.kind}{border.cost !== undefined
                    ? ` · ${border.cost}`
                    : ''}
            </p>{/each}
    {:else}
        <p>Select a hex, track segment, or station space.</p>
    {/if}
</aside>

<style>
    aside {
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
        color: #27363a;
    }
    h2 {
        font-size: 18px;
        margin: 0 0 12px;
    }
    p {
        margin: 8px 0;
    }
</style>

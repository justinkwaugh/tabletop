<script lang="ts">
    import type { StationReservation } from '@tabletop/18xx'
    import TileArtwork from '../tiles/TileArtwork.svelte'
    import { ClassicTileAppearance, type TileAppearance } from '../tiles/tileAppearance.js'
    import {
        assertMapOverlays,
        printedMapReservations,
        type MapDrawing,
        type MapSelection,
        type MapToken,
        type MapRoute
    } from './mapDrawing.js'

    let {
        scene,
        selection,
        tokens = [],
        reservations,
        routes = [],
        appearance = ClassicTileAppearance,
        hexDiameter = 100,
        onselect
    }: {
        scene: MapDrawing
        selection?: MapSelection
        tokens?: readonly MapToken[]
        reservations?: readonly StationReservation[]
        routes?: readonly MapRoute[]
        appearance?: TileAppearance
        hexDiameter?: number
        onselect?: (selection: MapSelection) => void
    } = $props()
    const currentReservations = $derived(reservations ?? printedMapReservations(scene))
    const entries = $derived.by(() => {
        assertMapOverlays(scene, tokens, routes, currentReservations)
        return scene.locations
    })
    let focusedLocationId = $derived.by((): string | undefined => {
        scene
        return undefined
    })
    const selectedPath = $derived(selection?.kind === 'path' ? selection.pathId : undefined)

    function select(event: MouseEvent | KeyboardEvent, target: MapSelection) {
        if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return
        event.stopPropagation()
        event.preventDefault()
        onselect?.(target)
    }
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    width={(scene.bounds.width * hexDiameter) / 100}
    height={(scene.bounds.height * hexDiameter) / 100}
    viewBox={`${scene.bounds.x} ${scene.bounds.y} ${scene.bounds.width} ${scene.bounds.height}`}
    role="group"
    aria-label={`${scene.map.definition.name} map`}
    class="map-scene"
>
    {#each entries as entry (entry.location.id)}
        {@const id = entry.location.id}
        {@const selected = selection?.locationId === id}
        {@const target: MapSelection = { kind: 'hex', locationId: id }}
        <g
            transform={`translate(${entry.center.x} ${entry.center.y})`}
            data-map-location={id}
            data-placed={entry.placed}
            role="button"
            tabindex="0"
            aria-label={`${id}${entry.location.name ? ` ${entry.location.name}` : ''}`}
            aria-pressed={selected}
            onfocus={(event) =>
                (focusedLocationId = event.currentTarget.matches(':focus-visible')
                    ? id
                    : undefined)}
            onblur={() => (focusedLocationId = undefined)}
            onclick={(event) => select(event, target)}
            onkeydown={(event) => select(event, target)}
        >
            <title>{id} {entry.location.name ?? ''}</title>
            <TileArtwork
                face={entry.face}
                drawing={entry.drawing}
                {appearance}
                showZeroRevenue={false}
            >
                {#snippet trackOverlay(drawing)}
                    {#each routes as route (route.id)}
                        {#each drawing.paths.filter( (path) => route.segments.some((segment) => segment.locationId === id && segment.pathId === path.id) ) as path (path.id)}
                            <path
                                data-map-route={route.id}
                                d={path.d}
                                fill="none"
                                stroke={route.color}
                                stroke-width="3"
                            />
                        {/each}
                    {/each}
                    {#if selected && selection?.kind === 'path'}
                        {#each drawing.paths.filter((path) => path.id === selectedPath) as path}
                            <path d={path.d} fill="none" stroke="#d52f83" stroke-width="3" />
                        {/each}
                    {/if}
                {/snippet}
                {#snippet overlays(drawing)}
                    {#each drawing.nodes as node (node.node.id)}
                        {@const reservationLabel = currentReservations
                            .filter(
                                (reservation) =>
                                    reservation.locationId === id &&
                                    reservation.nodeId === node.node.id
                            )
                            .map((reservation) => reservation.companyId)
                            .join('/')}
                        {#each node.slots as point, slot}
                            {@const token = tokens.find(
                                (token) =>
                                    token.locationId === id &&
                                    token.nodeId === node.node.id &&
                                    token.slot === slot
                            )}
                            {#if token}
                                <g data-map-token={token.id}>
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r="9"
                                        fill={token.color}
                                        stroke="white"
                                        stroke-width="0.7"
                                    />
                                    <text
                                        x={point.x}
                                        y={point.y}
                                        text-anchor="middle"
                                        dominant-baseline="central"
                                        font-size="6"
                                        fill="white">{token.label}</text
                                    >
                                </g>
                            {/if}
                            {#if slot === 0 && reservationLabel}
                                <text
                                    x={point.x}
                                    y={point.y + (token ? 15 : 0)}
                                    text-anchor="middle"
                                    dominant-baseline={token ? 'auto' : 'central'}
                                    font-size="5"
                                    fill="#52545b"
                                    paint-order="stroke"
                                    stroke={token ? 'white' : 'none'}
                                    stroke-width="1"
                                    data-map-reservation>{reservationLabel}</text
                                >
                            {/if}
                        {/each}
                    {/each}
                {/snippet}
            </TileArtwork>
            <g
                class="map-annotations"
                fill="#202c31"
                text-anchor="middle"
                paint-order="stroke"
                stroke={appearance.colors[entry.face.color]}
                stroke-width="1.7"
            >
                {#if entry.location.name}
                    <text y="-35" font-size="5" font-weight="650"
                        >{entry.location.name.length > 23
                            ? `${entry.location.name.slice(0, 22)}…`
                            : entry.location.name}</text
                    >
                {/if}
                {#if !entry.placed && entry.location.terrain}
                    <text
                        y={entry.face.nodes.length || entry.face.paths.length ? 23 : 4}
                        font-size="8"
                        font-weight="700"
                        data-map-terrain
                    >
                        {entry.location.terrain.kinds
                            .map((kind) =>
                                kind === 'mountain'
                                    ? '▲'
                                    : kind === 'water'
                                      ? '≈'
                                      : kind === 'urban'
                                        ? '▦'
                                        : kind
                            )
                            .join(' ')}
                        {entry.location.terrain.cost}
                    </text>
                {/if}
                <text y="36" font-size="5" font-weight="650" data-map-markers
                    >{[
                        ...(entry.location.upgradeLabels ?? []).map(
                            (label) => `${label.label} (${label.color})`
                        ),
                        ...(entry.location.markers ?? []).map((marker) => marker.label)
                    ].join(' · ')}</text
                >
            </g>
            {#each entry.drawing.paths as path (path.id)}
                {@const pathTarget: MapSelection = { kind: 'path', locationId: id, pathId: path.id }}
                <path
                    data-map-path={path.id}
                    d={path.d}
                    fill="none"
                    stroke="transparent"
                    stroke-width="12"
                    role="button"
                    tabindex="0"
                    aria-label={`${id} path ${path.id}`}
                    class="hit-path"
                    onclick={(event) => select(event, pathTarget)}
                    onkeydown={(event) => select(event, pathTarget)}
                />
            {/each}
            {#each entry.drawing.nodes as node (node.node.id)}
                {#if node.slots.length === 0}
                    {@const nodeTarget: MapSelection = { kind: 'node', locationId: id, nodeId: node.node.id }}
                    <circle
                        data-map-node={node.node.id}
                        cx={node.center.x}
                        cy={node.center.y}
                        r="9"
                        fill="transparent"
                        role="button"
                        tabindex="0"
                        aria-label={`${id} ${node.node.kind} ${node.node.id}`}
                        class="hit-node"
                        onclick={(event) => select(event, nodeTarget)}
                        onkeydown={(event) => select(event, nodeTarget)}
                    />
                {/if}
                {#each node.slots as point, slot}
                    {@const slotTarget: MapSelection = { kind: 'slot', locationId: id, nodeId: node.node.id, slot }}
                    <circle
                        data-map-slot={`${node.node.id}:${slot}`}
                        cx={point.x}
                        cy={point.y}
                        r="10"
                        fill="transparent"
                        stroke={selected &&
                        selection?.kind === 'slot' &&
                        selection.nodeId === node.node.id &&
                        selection.slot === slot
                            ? '#d52f83'
                            : 'none'}
                        stroke-width="2"
                        role="button"
                        tabindex="0"
                        aria-label={`${id} ${node.node.id} slot ${slot + 1}`}
                        class="hit-node"
                        onclick={(event) => select(event, slotTarget)}
                        onkeydown={(event) => select(event, slotTarget)}
                    />
                {/each}
            {/each}
        </g>
    {/each}
    <g data-map-layer="outlines" fill="none" pointer-events="none" aria-hidden="true">
        {#each entries as entry (entry.location.id)}
            <polygon
                transform={`translate(${entry.center.x} ${entry.center.y})`}
                points={entry.drawing.polygon}
                stroke="#566368"
                stroke-width="0.6"
            />
        {/each}
    </g>
    <g data-map-layer="borders" pointer-events="none" aria-hidden="true">
        {#each entries as entry (entry.location.id)}
            <g transform={`translate(${entry.center.x} ${entry.center.y})`}>
                {#each entry.borders as { start, end, border }}
                    <line
                        data-map-border={border.edge}
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={border.kind === 'water'
                            ? '#226db5'
                            : border.kind === 'mountain'
                              ? '#875e36'
                              : '#b02235'}
                        stroke-width="3"
                    />
                {/each}
            </g>
        {/each}
    </g>
    <g
        data-map-layer="highlights"
        fill="none"
        stroke="#d52f83"
        pointer-events="none"
        aria-hidden="true"
    >
        {#each entries.filter((entry) => entry.location.id === selection?.locationId || entry.location.id === focusedLocationId) as entry (entry.location.id)}
            <polygon
                data-map-highlight={entry.location.id}
                transform={`translate(${entry.center.x} ${entry.center.y})`}
                points={entry.drawing.polygon}
                stroke-width={entry.location.id === focusedLocationId ? 3 : 2.5}
            />
        {/each}
    </g>
</svg>

<style>
    .map-scene {
        display: block;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .map-annotations {
        pointer-events: none;
    }
    [role='button'] {
        cursor: pointer;
        outline: none;
    }
    .hit-path:focus-visible {
        stroke: #d52f83;
        stroke-width: 4;
    }
    .hit-node:focus-visible {
        stroke: #d52f83;
        stroke-width: 2;
    }
</style>

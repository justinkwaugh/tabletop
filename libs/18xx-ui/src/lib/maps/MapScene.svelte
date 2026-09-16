<script lang="ts">
    import CompanyToken from '../tokens/CompanyToken.svelte'
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
        legalLocationIds = [],
        highlightedLocationIds = legalLocationIds,
        maskUnavailableLocations = false,
        previewLocationId,
        translucentLocationId,
        selection,
        tokens = [],
        reservations,
        routes = [],
        appearance = ClassicTileAppearance,
        revenueStageColors,
        hexDiameter = 100,
        onselect
    }: {
        scene: MapDrawing
        legalLocationIds?: readonly string[]
        highlightedLocationIds?: readonly string[]
        maskUnavailableLocations?: boolean
        previewLocationId?: string
        translucentLocationId?: string
        selection?: MapSelection
        tokens?: readonly MapToken[]
        reservations?: readonly StationReservation[]
        routes?: readonly MapRoute[]
        revenueStageColors?: Readonly<Record<string, string>>
        appearance?: TileAppearance
        hexDiameter?: number
        onselect?: (selection: MapSelection) => void
    } = $props()
    const perimeterMaskId = $props.id()
    const perimeterRoundingId = `${perimeterMaskId}-rounding`
    const currentReservations = $derived(reservations ?? printedMapReservations(scene))
    const entries = $derived.by(() => {
        assertMapOverlays(scene, tokens, routes, currentReservations)
        return scene.locations
    })
    let focusedLocationId = $derived.by((): string | undefined => {
        scene
        return undefined
    })
    let hoveredLocationId = $derived.by((): string | undefined => {
        scene
        maskUnavailableLocations
        legalLocationIds
        return undefined
    })
    const selectedPath = $derived(selection?.kind === 'path' ? selection.pathId : undefined)

    function select(event: MouseEvent | KeyboardEvent, target: MapSelection) {
        if (!onselect) return
        if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return
        event.stopPropagation()
        event.preventDefault()
        if (maskUnavailableLocations && !legalLocationIds.includes(target.locationId)) return
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
    {#if maskUnavailableLocations}
        <defs>
            <filter id={perimeterRoundingId} filterUnits="userSpaceOnUse" {...scene.bounds} color-interpolation-filters="sRGB">
                <feGaussianBlur stdDeviation="5" />
                <feComponentTransfer>
                    <feFuncA type="linear" slope="20" intercept="-9.5" />
                </feComponentTransfer>
            </filter>
            <mask id={perimeterMaskId} maskUnits="userSpaceOnUse" {...scene.bounds}>
                <g fill="white" stroke="white" stroke-width="50" stroke-linejoin="round" filter={`url(#${perimeterRoundingId})`}>
                    {#each entries as entry (entry.location.id)}
                        <polygon transform={`translate(${entry.center.x} ${entry.center.y})`} points={entry.drawing.polygon} />
                    {/each}
                </g>
                <g fill="black">
                    {#each entries as entry (entry.location.id)}
                        <polygon transform={`translate(${entry.center.x} ${entry.center.y})`} points={entry.drawing.polygon} />
                    {/each}
                </g>
            </mask>
        </defs>
        <rect {...scene.bounds} mask={`url(#${perimeterMaskId})`} fill="#24272b" fill-opacity="0.45" pointer-events="none" data-map-layer="masked-perimeter" />
    {/if}
    {#each entries as entry (entry.location.id)}
        {@const id = entry.location.id}
                {@const yellowUpgradeLabels = (entry.location.upgradeLabels ?? []).filter(
                    (label) => label.color === 'green' && ['X', 'T'].includes(label.label)
                )}
                {@const overlayLabels = yellowUpgradeLabels.filter((label) => !entry.face.labels.includes(label.label))}

        {@const available = !!onselect && (!maskUnavailableLocations || legalLocationIds.includes(id))}
        {@const selected = selection?.locationId === id}
        {@const target: MapSelection = { kind: 'hex', locationId: id }}
        <g
            transform={`translate(${entry.center.x} ${entry.center.y})`}
            data-map-location={id}
            data-placed={entry.placed}
            opacity={id === translucentLocationId ? 0.55 : 1}
            class:unavailable={!available}
            aria-disabled={!available}
            role="button"
            tabindex={available ? 0 : -1}
            aria-label={`${id}${entry.location.name ? ` ${entry.location.name}` : ''}`}
            aria-pressed={selected}
            onfocus={(event) =>
                (focusedLocationId = event.currentTarget.matches(':focus-visible')
                    ? id
                    : undefined)}
            onblur={() => (focusedLocationId = undefined)}
            onpointerenter={() => (hoveredLocationId = id)}
            onpointerleave={() => (hoveredLocationId = undefined)}
            onclick={(event) => select(event, target)}
            onkeydown={(event) => select(event, target)}
        >
            <TileArtwork
                face={entry.face}
                drawing={entry.drawing}
                {appearance}
                {revenueStageColors}
                showZeroRevenue={false}
            >
                {#snippet trackOverlay(drawing)}
                    {@const routePaths = routes.flatMap((route) =>
                        drawing.paths
                            .filter((path) =>
                                route.segments.some(
                                    (segment) =>
                                        segment.locationId === id && segment.pathId === path.id
                                )
                            )
                            .map((path) => ({ route, path }))
                    )}
                    <g fill="none" stroke-width="8" stroke-linejoin="round">
                        {#each routePaths as { route, path } (`${route.id}:${path.id}`)}
                            <path data-map-route={route.id} d={path.d} stroke={route.color} />
                        {/each}
                    </g>
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
                                    <CompanyToken
                                        appearance={token}
                                        size={18}
                                        x={point.x - 9}
                                        y={point.y - 9}
                                    />
                                </g>
                            {/if}
                            {#if slot === 0 && reservationLabel && !token}
                                <text
                                    x={point.x}
                                    y={point.y}
                                    text-anchor="middle"
                                    dominant-baseline="central"
                                    font-size="5"
                                    fill="#52545b"
                                    paint-order="stroke"
                                    stroke="none"
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
                {#if entry.location.name && !entry.placed}
                    <text y="-35" font-size="5" font-weight="650"
                        >{entry.location.name.length > 23
                            ? `${entry.location.name.slice(0, 22)}…`
                            : entry.location.name}</text
                    >
                {/if}
                {#if !entry.placed && entry.location.terrain}
                    {@const terrain = entry.location.terrain}
                    {@const iconWidth = terrain.kinds.length * 19}
                    {@const labelWidth = String(terrain.cost).length * 6.5}
                    <g data-map-terrain
                        transform={`translate(${-(iconWidth + labelWidth) / 2} ${(entry.face.nodes.length || entry.face.paths.length ? 19 : 0) + (terrain.kinds.includes('water') && entry.face.nodes.some((node) => node.kind === 'city' || node.kind === 'town') ? 3 : 0)})`}>
                        {#each terrain.kinds as kind, index}
                            <g transform={`translate(${index * 19} 0)`} stroke="none">
                                {#if kind === 'mountain'}
                                    <path d="M0 5 L6 -6 L10 0 L13 -4 L19 5 Z" fill="#936039" />
                                {:else if kind === 'water'}
                                    <path transform="translate(2 0) scale(0.75 1)"
                                        d="M0 -2 C3 -6 6 -6 9 -2 S15 2 18 -2 M0 2 C3 -2 6 -2 9 2 S15 6 18 2"
                                        fill="none" stroke="#287fab" stroke-width="1.8" stroke-linecap="round" />
                                {:else}
                                    <text x="8" y="4" font-size="11" font-weight="700">{kind === 'urban' ? '▦' : kind}</text>
                                {/if}
                            </g>
                        {/each}
                        <text x={iconWidth + 2} y="4" text-anchor="start" font-size="10" font-weight="750">{terrain.cost}</text>
                    </g>
                {/if}
                {#if entry.placed && entry.face.color === 'yellow' && overlayLabels.length}
                    <text data-map-upgrade-label
                        dominant-baseline="central" fill={appearance.ink}
                        x={entry.drawing.labelPosition.x}
                        y={entry.drawing.labelPosition.y}
                        font-size="12" font-weight="850" stroke-width="2.5">{overlayLabels.map((label) => label.label).join(' ')}</text>
                {/if}
                {#each entry.location.markers ?? [] as marker (marker.id)}
                    {#if !entry.placed && entry.markerImages[marker.id]}
                        <image href={entry.markerImages[marker.id]} x="-25" y="-25" width="50" height="40" />
                    {/if}
                {/each}
                <text y="36" font-size="5" font-weight="650" data-map-markers
                    >{[
                        ...(entry.location.upgradeLabels ?? []).filter((label) => !yellowUpgradeLabels.includes(label)).map(
                            (label) => `${label.label} (${label.color})`
                        ),
                        ...(entry.location.markers ?? []).filter((marker) => !entry.markerImages[marker.id]).map((marker) => marker.label)
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
                    tabindex={available ? 0 : -1}
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
                        tabindex={available ? 0 : -1}
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
                        tabindex={available ? 0 : -1}
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
    {#if maskUnavailableLocations}
        <g
            data-map-layer="unavailable"
            fill="#24272b"
            fill-opacity="0.45"
            pointer-events="none"
            aria-hidden="true"
        >
            {#each entries.filter((entry) => !highlightedLocationIds.includes(entry.location.id)) as entry (entry.location.id)}
                <polygon
                    data-map-masked={entry.location.id}
                    transform={`translate(${entry.center.x} ${entry.center.y})`}
                    points={entry.drawing.polygon}
                />
            {/each}
        </g>
    {/if}
    <g
        data-map-layer="highlights"
        fill="none"
        stroke="#f07818"
        pointer-events="none"
        aria-hidden="true"
    >
        {#each entries.filter((entry) => entry.location.id === selection?.locationId || entry.location.id === focusedLocationId || entry.location.id === previewLocationId || (maskUnavailableLocations && entry.location.id === hoveredLocationId && legalLocationIds.includes(entry.location.id))) as entry (entry.location.id)}
            <polygon
                data-map-highlight={entry.location.id}
                data-track-preview={entry.location.id === previewLocationId ? entry.location.id : undefined}
                data-map-hover={maskUnavailableLocations &&
                entry.location.id === hoveredLocationId &&
                legalLocationIds.includes(entry.location.id)
                    ? entry.location.id
                    : undefined}
                transform={`translate(${entry.center.x} ${entry.center.y})`}
                points={entry.drawing.polygon}
                stroke-width="8"
                stroke-linejoin="round"
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
    .unavailable {
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

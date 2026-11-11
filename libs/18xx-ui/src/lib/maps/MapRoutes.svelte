<script lang="ts">
    import type { MapDrawing, MapRoute } from './mapDrawing.js'
    import type { TileAppearance } from '../tiles/tileAppearance.js'
    import { ExtensionDash, drawMapRoutes } from './routeDrawing.js'
    import { spikePoints } from '../tiles/tileTrackGeometry.js'

    let {
        scene,
        routes,
        appearance
    }: { scene: MapDrawing; routes: readonly MapRoute[]; appearance: TileAppearance } = $props()
    const maskId = $props.id()
    const locations = $derived(drawMapRoutes(scene, routes))
    const choosing = $derived(routes.some((route) => route.chosen))
    const RouteWidth = 6.5
    const RouteEdgeWidth = 9
    const RouteLayers = ['edge', 'fill'] as const
    // An interconnection extension runs a dashed white line down its band.
    const ExtensionLineWidth = 1.6
    // Routes other than the one being drawn stay in view behind it, greyed rather than made
    // translucent, so the board needs no offscreen layer (docs/phone-rendering.md).
    const faded = (color: string) => `color-mix(in srgb, ${color} 45%, #a7a29a)`
    const StartWidth = 3
</script>

<g data-map-layer="routes" pointer-events="none" aria-hidden="true">
    <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" {...scene.bounds}>
            <rect {...scene.bounds} fill="white"></rect>
            {#each scene.locations.filter((entry) => !entry.hidden) as entry (entry.location.id)}
                <g transform={`translate(${entry.center.x} ${entry.center.y})`} fill="black">
                    {#each entry.drawing.nodes.filter((node) => node.node.kind !== 'city') as node (node.node.id)}
                        {#if node.node.kind === 'town' && appearance.townMarker === 'bar' && node.townAngle !== undefined}
                            <rect
                                x="-9"
                                y="-4.5"
                                width="18"
                                height="9"
                                transform={`translate(${node.center.x} ${node.center.y}) rotate(${node.townAngle})`}
                            ></rect>
                        {:else if node.node.kind === 'offboard'}
                            <rect
                                x={node.center.x - 7}
                                y={node.center.y - 7}
                                width="14"
                                height="14"
                                rx="2"
                            ></rect>
                        {:else}
                            <circle
                                cx={node.center.x}
                                cy={node.center.y}
                                r={node.node.kind === 'town' ? node.dotRadius + 0.35 : 3}
                            ></circle>
                        {/if}
                    {/each}
                </g>
            {/each}
            {#each locations as location (location.id)}
                <g transform={`translate(${location.center.x} ${location.center.y})`}>
                    {#each location.cities as city (city.id)}
                        <path d={city.d} fill="black"></path>
                    {/each}
                </g>
            {/each}
        </mask>
    </defs>
    <g mask={`url(#${maskId})`} fill="none" stroke-linecap="round" stroke-linejoin="round">
        {#each [false, true] as chosen (chosen)}
            <g>
                {#each RouteLayers as layer (layer)}
                    {#each locations as location (location.id)}
                        <g transform={`translate(${location.center.x} ${location.center.y})`}>
                            {#each location.paths.filter((path) => path.chosen === chosen) as path (path.id)}
                                {@const edge = layer === 'edge'}
                                {@const width = path.width ?? RouteWidth}
                                {@const color =
                                    choosing && !chosen ? faded(path.color) : path.color}
                                {@const stroke = edge
                                    ? `color-mix(in srgb, ${color} 55%, black)`
                                    : color}
                                {#if path.spike}
                                    <polygon
                                        data-map-route={edge ? undefined : path.routeId}
                                        points={spikePoints(path.spike, width)}
                                        fill={stroke}
                                        stroke={edge ? stroke : 'none'}
                                        stroke-width={RouteEdgeWidth - RouteWidth}
                                    ></polygon>
                                {:else}
                                    <path
                                        data-map-route={edge ? undefined : path.routeId}
                                        d={path.d}
                                        {stroke}
                                        stroke-width={edge
                                            ? width + RouteEdgeWidth - RouteWidth
                                            : width}
                                    ></path>
                                    {#if path.extension && !edge}
                                        <path
                                            data-map-route-extension={path.routeId}
                                            d={path.d}
                                            stroke="white"
                                            stroke-width={ExtensionLineWidth}
                                            stroke-dasharray={`${ExtensionDash.drawn} ${ExtensionDash.gap}`}
                                            stroke-dashoffset={path.dashOffset}
                                            stroke-linecap="butt"
                                        ></path>
                                    {/if}
                                {/if}
                            {/each}
                        </g>
                    {/each}
                {/each}
            </g>
        {/each}
    </g>
    {#each locations as location (location.id)}
        {#each location.starts as start (start.id)}
            <path
                data-map-route-start={start.id}
                transform={`translate(${location.center.x} ${location.center.y})`}
                d={start.d}
                fill="none"
                stroke={start.color}
                stroke-width={StartWidth}
            ></path>
        {/each}
    {/each}
</g>

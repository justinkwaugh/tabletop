<script lang="ts">
    import type { MapDrawing, MapRoute } from './mapDrawing.js'
    import type { TileAppearance } from '../tiles/tileAppearance.js'
    import { drawMapRoutes } from './routeDrawing.js'

    let {
        scene,
        routes,
        appearance
    }: { scene: MapDrawing; routes: readonly MapRoute[]; appearance: TileAppearance } = $props()
    const maskId = $props.id()
    const locations = $derived(drawMapRoutes(scene, routes))
</script>

<g data-map-layer="routes" pointer-events="none" aria-hidden="true">
    <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" {...scene.bounds}>
            <rect {...scene.bounds} fill="white"></rect>
            {#each scene.locations as entry (entry.location.id)}
                <g transform={`translate(${entry.center.x} ${entry.center.y})`} fill="black">
                    {#each entry.drawing.nodes.filter((node) => node.node.kind !== 'city') as node (node.node.id)}
                        {#if node.node.kind === 'town' && appearance.townMarker === 'bar' && node.townAngle !== undefined}
                            <rect
                                x="-7.5"
                                y="-3.5"
                                width="15"
                                height="7"
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
                                r={node.node.kind === 'town'
                                    ? node.townAngle === undefined
                                        ? 6.65
                                        : 4.55
                                    : 3}
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
        {#each [9, 6.5] as width}
            {#each locations as location (location.id)}
                <g transform={`translate(${location.center.x} ${location.center.y})`}>
                    {#each location.paths as path (path.id)}
                        <path
                            data-map-route={width === 6.5 ? path.routeId : undefined}
                            d={path.d}
                            stroke={width === 9
                                ? `color-mix(in srgb, ${path.color} 55%, black)`
                                : path.color}
                            stroke-width={width}
                        ></path>
                    {/each}
                </g>
            {/each}
        {/each}
    </g>
</g>

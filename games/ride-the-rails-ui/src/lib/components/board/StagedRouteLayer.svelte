<script lang="ts">
    import { usaCity } from '@tabletop/ride-the-rails'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { routeSegments, routeStationHexes, type StagedRoute } from '$lib/utils/routePath.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { route }: { route: StagedRoute } = $props()

    const startHexId = $derived(route.startCityId ? usaCity(route.startCityId).hexId : undefined)
    const segments = $derived(routeSegments(route.links))
    const stations = $derived(
        startHexId || route.links.length > 0
            ? routeStationHexes(route.links, startHexId).map(hexCenter)
            : []
    )
    const last = $derived(route.links.length > 0 ? stations.at(-1) : undefined)
</script>

<!-- R-3.3.2: the draft through its hex centres, each link in its railroad's colour. -->
<g class="staged-route" aria-hidden="true">
    <g fill="none" stroke-linejoin="round" stroke-linecap="round">
        {#each segments as segment (segment.key)}
            <polyline points={segment.points} stroke="var(--rtr-halo)" stroke-width="11.6"
            ></polyline>
        {/each}
        {#each segments as segment (segment.key)}
            <polyline
                points={segment.points}
                stroke={railroadStyle(segment.railroadId).fill}
                stroke-width="6.8"
            ></polyline>
        {/each}
    </g>
    {#each stations as station, index (index)}
        <circle
            cx={station.x}
            cy={station.y}
            r="6.8"
            fill="var(--rtr-station)"
            stroke="var(--rtr-halo)"
            stroke-width="2.8"
        ></circle>
    {/each}
    {#if last}
        <circle
            cx={last.x + 38}
            cy={last.y - 6}
            r="11.2"
            fill="var(--rtr-ink)"
            stroke="var(--rtr-station)"
            stroke-width="2"
        ></circle>
        <text
            x={last.x + 38}
            y={last.y - 0.8}
            font-size="14.8"
            font-weight="800"
            text-anchor="middle"
            fill="var(--rtr-panel)">{route.links.length}</text
        >
    {/if}
</g>

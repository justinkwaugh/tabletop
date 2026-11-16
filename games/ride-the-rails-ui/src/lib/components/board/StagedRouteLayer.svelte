<script lang="ts">
    import { usaCity, type Track } from '@tabletop/ride-the-rails'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import {
        routeCubes,
        routeCubeSegments,
        routeStations,
        type StagedRoute
    } from '$lib/utils/routePath.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import RailroadPiece from './RailroadPiece.svelte'

    let { route, track }: { route: StagedRoute; track: Track } = $props()

    const startHexId = $derived(route.startCityId ? usaCity(route.startCityId).hexId : undefined)
    const segments = $derived(routeCubeSegments(route.links, track))
    const cubes = $derived(routeCubes(route.links, track))
    const stations = $derived(routeStations(route.links, track, startHexId))
    // The link count sits beside the last city's centre.
    const lastHexId = $derived(route.links.at(-1)?.hexIds.at(-1))
    const last = $derived(lastHexId ? hexCenter(lastHexId) : undefined)
</script>

<!-- R-3.3.2: the draft through the cubes it rides, each link in its railroad's colour, those cubes
     drawn again on top so they stand above the scrim, a station dot on each city's cube. -->
<g class="staged-route" aria-hidden="true">
    <g fill="none" stroke-linejoin="round" stroke-linecap="round">
        {#each segments as segment (segment.key)}
            <polyline points={segment.points} stroke="var(--rtr-halo)" stroke-width="9.6"
            ></polyline>
        {/each}
        {#each segments as segment (segment.key)}
            <polyline
                points={segment.points}
                stroke={railroadStyle(segment.railroadId).fill}
                stroke-width="5.2"
            ></polyline>
        {/each}
    </g>
    {#each cubes as cube (cube.key)}
        <RailroadPiece
            railroadId={cube.railroadId}
            x={cube.slot.x}
            y={cube.slot.y}
            width={cube.slot.width}
        />
    {/each}
    {#each stations as station, index (index)}
        <circle
            cx={station.x}
            cy={station.y}
            r="4.6"
            fill="var(--rtr-white)"
            stroke="var(--rtr-halo)"
            stroke-width="2.2"
        ></circle>
    {/each}
    {#if last}
        <circle
            cx={last.x + 38}
            cy={last.y - 6}
            r="11.2"
            fill="var(--rtr-ink)"
            stroke="var(--rtr-white)"
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

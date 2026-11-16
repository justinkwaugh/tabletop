<script lang="ts">
    import type { Track } from '@tabletop/ride-the-rails'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { routeCubes, routeCubeSegments, type StagedRoute } from '$lib/utils/routePath.js'
    import { cubicOut } from 'svelte/easing'
    import { draw } from 'svelte/transition'
    import { prefersReducedMotion } from '$lib/animators/motion.js'
    import {
        passengerSpot,
        startPassengerSpot,
        type PassengerSpot
    } from '$lib/utils/passengerLayout.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import PassengerFigure from './PassengerFigure.svelte'
    import RailroadPiece from './RailroadPiece.svelte'

    let { route, track }: { route: StagedRoute; track: Track } = $props()

    const segments = $derived(routeCubeSegments(route.links, track))
    const cubes = $derived(routeCubes(route.links, track))
    const rider = $derived(
        route.startCityId
            ? {
                  from: passengerSpot(route.startCityId, false),
                  to: startPassengerSpot(route.startCityId)
              }
            : undefined
    )

    // Local presentation of a staged pick, not of a game state: the picked start's passenger grows
    // from its place in the hex's top right to the middle, writing its own transform each frame.
    function grow(node: SVGGElement, { from, to }: { from: PassengerSpot; to: PassengerSpot }) {
        const at = (t: number) =>
            `translate(${from.x + (to.x - from.x) * t} ${from.y + (to.y - from.y) * t}) scale(${
                from.scale + (to.scale - from.scale) * t
            })`
        return {
            duration: prefersReducedMotion() ? 0 : GROW_MS,
            easing: cubicOut,
            tick: (t: number) => node.setAttribute('transform', at(t))
        }
    }
    const GROW_MS = 260
    // A new link draws itself from the city before to the city it reaches.
    const lineDraw = { duration: prefersReducedMotion() ? 0 : 320, easing: cubicOut }

    // The link count sits on the last city's centre.
    const lastHexId = $derived(route.links.at(-1)?.hexIds.at(-1))
    const last = $derived(lastHexId ? hexCenter(lastHexId) : undefined)
</script>

<!-- R-3.3.2: the draft through the cubes it rides, each link in its railroad's colour, those cubes
     drawn again on top so they stand above the scrim, and the start's passenger grown and centred in its hex. -->
<g class="staged-route" aria-hidden="true">
    <g fill="none" stroke-linejoin="round" stroke-linecap="round">
        {#each segments as segment (segment.key)}
            <polyline
                points={segment.points}
                stroke="var(--rtr-halo)"
                stroke-width="9.6"
                in:draw={lineDraw}
            ></polyline>
        {/each}
        {#each segments as segment (segment.key)}
            <polyline
                points={segment.points}
                stroke={railroadStyle(segment.railroadId).fill}
                stroke-width="5.2"
                in:draw={lineDraw}
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
    {#if rider}
        <g
            transform="translate({rider.to.x} {rider.to.y}) scale({rider.to.scale})"
            in:grow={rider}
            data-start-passenger
        >
            <PassengerFigure />
        </g>
    {/if}
    {#if last}
        <!-- The link count, centred on the city the route has reached. -->
        <circle
            cx={last.x}
            cy={last.y}
            r="13"
            fill="var(--rtr-ink)"
            stroke="var(--rtr-white)"
            stroke-width="2.2"
        ></circle>
        <text
            x={last.x}
            y={last.y + 6}
            font-size="17"
            font-weight="800"
            text-anchor="middle"
            fill="var(--rtr-panel)">{route.links.length}</text
        >
    {/if}
</g>

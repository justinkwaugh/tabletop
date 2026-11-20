<script lang="ts">
    import { Routes, type RouteMedium } from '@tabletop/feudum'
    import { MapAsset, assetUrl } from '$lib/art/assetMap.js'
    import { PlainChrome, dimmedWithRest, type BoardChrome } from '$lib/model/boardChrome.js'
    import { MapArea, RoutePaths, routeD, routePointAt } from '$lib/utils/boardGeometry.js'
    import DimVeil from './DimVeil.svelte'
    import RouteGlyph from './RouteGlyph.svelte'

    /**
     * R-1.2.2 The five media, each with its own line and glyph. The printed map carries its routes,
     * so with its file there this layer draws nothing at rest. R-3.7.1 A Move's trail is lit over
     * either, each step numbered in press order.
     */
    let { chrome = PlainChrome }: { chrome?: BoardChrome } = $props()

    const Lines: Record<
        RouteMedium,
        { token: string; width: number; dash?: string; cap: 'round' | 'butt' }
    > = {
        road: { token: 'road', width: 7, cap: 'round' },
        ship: { token: 'ship', width: 5, dash: '1 11', cap: 'round' },
        submersible: { token: 'submersible', width: 4, dash: '16 7 2 7', cap: 'butt' },
        'flying-machine': { token: 'flying', width: 4, dash: '2 14', cap: 'round' },
        ferry: { token: 'ferry', width: 5, dash: '12 6', cap: 'butt' }
    }
    let drawn = $derived(assetUrl(MapAsset) ? [] : Routes)
    let trail = $derived(
        (chrome.offer.trail ?? []).flatMap((step) => {
            const route = Routes.find(
                ({ medium, a, b }) =>
                    medium === step.medium &&
                    ((a === step.from && b === step.to) || (a === step.to && b === step.from))
            )
            const path = route && RoutePaths.get(route.id)
            return path ? [{ step, path, middle: routePointAt(path, 0.5) }] : []
        })
    )
</script>

<g>
    {#each drawn as route (route.id)}
        {@const path = RoutePaths.get(route.id)}
        {@const line = Lines[route.medium]}
        {#if path}
            {@const middle = routePointAt(path, 0.5)}
            <path
                d={routeD(path)}
                fill="none"
                stroke="var(--feudum-route-{line.token})"
                stroke-width={line.width}
                stroke-dasharray={line.dash}
                stroke-linecap={line.cap}
                data-route={route.id}
            ></path>
            <RouteGlyph medium={route.medium} x={middle.x} y={middle.y} />
        {/if}
    {/each}
</g>
{#if dimmedWithRest(chrome) !== undefined}
    <!-- The ground and the routes dim with the rest under one veil; the Move's trail stays over it. -->
    <DimVeil x={MapArea.x} y={MapArea.y} width={MapArea.width} height={MapArea.height} />
{/if}
{#each trail as { step, path, middle } (step.n)}
    <g data-trail={step.n} opacity={step.godspeed ? 0.6 : undefined}>
        <path
            d={routeD(path)}
            fill="none"
            stroke="var(--feudum-halo)"
            stroke-width="13"
            stroke-linecap="round"
        ></path>
        <path
            d={routeD(path)}
            fill="none"
            stroke="var(--feudum-accent)"
            stroke-width="8"
            stroke-linecap="round"
        ></path>
        <circle
            cx={middle.x}
            cy={middle.y}
            r="17"
            fill="var(--feudum-accent)"
            stroke="var(--feudum-halo)"
            stroke-width="4"
        ></circle>
        <text
            x={middle.x}
            y={middle.y + 8}
            text-anchor="middle"
            font-size="22"
            font-weight="700"
            fill="var(--feudum-primary)"
            style:font-family="var(--feudum-font-text)">{step.n}</text
        >
    </g>
{/each}

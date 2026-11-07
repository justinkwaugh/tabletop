<script lang="ts">
    import { Routes, type RouteMedium } from '@tabletop/feudum'
    import { MapAsset, assetUrl } from '$lib/art/assetMap.js'
    import { RoutePaths, routeD, routePointAt } from '$lib/utils/boardGeometry.js'
    import RouteGlyph from './RouteGlyph.svelte'

    /**
     * R-1.2.2 The five media, each with its own line and glyph. The printed map carries its routes,
     * so with its file there this layer draws nothing at rest.
     */
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
</script>

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

<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { getShop, shopVisits, type Route } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LineHaloFilterId } from '$lib/utils/boardGeometry.js'
    import {
        BranchDash,
        flowSeconds,
        routeLine,
        RouteDash,
        shopBranch
    } from '$lib/utils/routePreview.js'

    let { route }: { route: Route } = $props()

    const gameSession = getGameSession()

    // Each line is drawn from its end back to its start; see routePreview.ts.
    function flowPoints(line: Point[]): string {
        return line
            .toReversed()
            .map((point) => `${point.x},${point.y}`)
            .join(' ')
    }

    let points = $derived(flowPoints(routeLine(route)))
    let branches = $derived.by(() => {
        const { visits } = shopVisits(
            route,
            gameSession.gameState.getFountainState(route.from).visitors,
            (shopId) => gameSession.gameState.getShopState(shopId).ownerId !== undefined
        )
        return visits.map(({ shopId }) => ({
            shopId,
            points: flowPoints(shopBranch(route, shopId)),
            color: gameSession.marketPalettes[getShop(shopId).color].fill
        }))
    })
</script>

{#snippet flowLine(
    linePoints: string,
    color: string,
    width: number,
    pattern: { dash: number; gap: number }
)}
    <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        stroke-width={width}
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.35"
        filter="url(#{LineHaloFilterId})"
    ></polyline>
    <polyline
        class="flow"
        points={linePoints}
        fill="none"
        stroke={color}
        stroke-width={width}
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray="{pattern.dash} {pattern.gap}"
        style:--flow-period="{pattern.dash + pattern.gap}px"
        style:--flow-seconds="{flowSeconds(pattern)}s"
        filter="url(#{LineHaloFilterId})"
    ></polyline>
{/snippet}

<g pointer-events="none">
    {#each branches as branch (branch.shopId)}
        {@render flowLine(branch.points, branch.color, 5, BranchDash)}
    {/each}
    {@render flowLine(points, '#ffffff', 6, RouteDash)}
</g>

<style>
    .flow {
        animation: flow var(--flow-seconds) linear infinite;
    }

    @keyframes flow {
        to {
            stroke-dashoffset: var(--flow-period);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .flow {
            animation: none;
        }
    }
</style>

<script lang="ts">
    import { getShop, type Route, type ShopVisit } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LineHaloFilterId } from '$lib/utils/boardGeometry.js'
    import PawnCountChip from '$lib/components/PawnCountChip.svelte'
    import {
        BranchDash,
        flowPoints,
        flowSeconds,
        routeLine,
        RouteDash,
        shopBranch,
        type DashPattern
    } from '$lib/utils/routePreview.js'

    let { route, visits }: { route: Route; visits: readonly ShopVisit[] } = $props()

    const gameSession = getGameSession()

    let points = $derived(flowPoints(routeLine(route)))
    let branches = $derived(
        visits.map((visit) => {
            const line = shopBranch(route, visit.shopId)
            const marketColor = getShop(visit.shopId).color
            return {
                visit,
                marketColor,
                end: line[1],
                points: flowPoints(line),
                color: gameSession.marketPalettes[marketColor].fill
            }
        })
    )
</script>

{#snippet flowLine(linePoints: string, color: string, width: number, pattern: DashPattern)}
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
    {#each branches as branch (branch.visit.shopId)}
        {@render flowLine(branch.points, branch.color, 5, BranchDash)}
    {/each}
    {@render flowLine(points, '#ffffff', 6, RouteDash)}
    {#each branches as branch (branch.visit.shopId)}
        <PawnCountChip
            color={branch.marketColor}
            count={branch.visit.customers}
            x={branch.end.x}
            y={branch.end.y}
            label="{branch.visit.customers} entering shop {branch.visit.shopId}"
        />
    {/each}
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

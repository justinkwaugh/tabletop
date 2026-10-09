<script lang="ts">
    import { getShop, type Route, type ShopVisit } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PawnCountChip from '$lib/components/PawnCountChip.svelte'
    import RouteGlow from '$lib/components/RouteGlow.svelte'
    import type { Point } from '@tabletop/common'
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

    let line = $derived(routeLine(route))
    let points = $derived(flowPoints(line))
    let branches = $derived(
        visits.map((visit) => {
            const line = shopBranch(route, visit.shopId)
            const marketColor = getShop(visit.shopId).color
            return {
                visit,
                marketColor,
                line,
                end: line[1],
                points: flowPoints(line),
                color: gameSession.marketPalettes[marketColor].fill
            }
        })
    )
</script>

{#snippet flowLine(
    id: string,
    line: Point[],
    linePoints: string,
    color: string,
    width: number,
    pattern: DashPattern
)}
    <RouteGlow {id} {line} {color} {width} />
    <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        stroke-width={width}
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.35"
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
    ></polyline>
{/snippet}

<g pointer-events="none">
    {#each branches as branch (branch.visit.shopId)}
        {@render flowLine(
            `marracash-route-glow-${branch.visit.shopId}`,
            branch.line,
            branch.points,
            branch.color,
            5,
            BranchDash
        )}
    {/each}
    {@render flowLine('marracash-route-glow', line, points, '#ffffff', 6, RouteDash)}
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

<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { getFountain, getShop, type MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cellCenter, shopRect, ShopTileInset } from '$lib/utils/boardGeometry.js'
    import { routeLine, shopBranch } from '$lib/utils/routePreview.js'
    import { stallOutline } from '$lib/utils/stalls.js'
    import {
        eightPointedStar,
        EntranceRadii,
        FountainRadii,
        octagon
    } from '$lib/utils/fountainShape.js'
    import type { HistoryHighlight } from '$lib/utils/historyHighlight.js'

    let { highlight }: { highlight: HistoryHighlight } = $props()

    const gameSession = getGameSession()

    const RouteWidth = 6
    const BranchWidth = 5
    const White = '#ffffff'

    function points(line: Point[]): string {
        return line.map((point) => `${point.x},${point.y}`).join(' ')
    }

    function arrowId(color: MarketColor | 'route'): string {
        return `marracash-history-arrow-${color}`
    }

    let branches = $derived(
        highlight.kind === 'route'
            ? highlight.visits.map((visit) => {
                  const color = getShop(visit.shopId).color
                  return {
                      shopId: visit.shopId,
                      color,
                      stroke: gameSession.marketPalettes[color].fill,
                      line: shopBranch(highlight.route, visit.shopId)
                  }
              })
            : []
    )
</script>

{#snippet arrow(id: string, color: string)}
    <marker
        {id}
        viewBox="0 0 10 10"
        refX="7"
        refY="5"
        markerWidth="3.2"
        markerHeight="3.2"
        orient="auto-start-reverse"
    >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={color}></path>
    </marker>
{/snippet}

<g pointer-events="none">
    {#if highlight.kind === 'route'}
        <defs>
            {@render arrow(arrowId('route'), White)}
            {#each branches as branch (branch.shopId)}
                {@render arrow(arrowId(branch.color), branch.stroke)}
            {/each}
        </defs>
        {#each branches as branch (branch.shopId)}
            <polyline
                points={points(branch.line)}
                fill="none"
                stroke={branch.stroke}
                stroke-width={BranchWidth}
                stroke-linecap="round"
                marker-end="url(#{arrowId(branch.color)})"
            ></polyline>
        {/each}
        <polyline
            points={points(routeLine(highlight.route))}
            fill="none"
            stroke={White}
            stroke-width={RouteWidth}
            stroke-linecap="round"
            stroke-linejoin="round"
            marker-end="url(#{arrowId('route')})"
        ></polyline>
    {:else if highlight.kind === 'fountain'}
        {@const fountain = getFountain(highlight.fountainId)}
        {@const center = cellCenter(fountain.coords)}
        <path
            d={fountain.entrance
                ? eightPointedStar(center, EntranceRadii.trim)
                : octagon(center, FountainRadii.rim)}
            fill="none"
            stroke={White}
            stroke-width="5"
            stroke-linejoin="round"
            class="candidate-halo"
        ></path>
    {:else}
        {@const rect = shopRect(highlight.shopId, ShopTileInset)}
        <path
            transform="translate({rect.x} {rect.y})"
            d={stallOutline(highlight.shopId, rect.width, rect.height)}
            fill="none"
            stroke={White}
            stroke-width="5"
            stroke-linejoin="round"
            class="candidate-halo"
        ></path>
    {/if}
</g>

<script lang="ts">
    import { onMount } from 'svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { buildDeliveryShippingRoutePath } from '$lib/utils/shippingRouteOverlay.js'

    type DeliveryShippingRouteOverlay = {
        routeKey: string
        path: string
        color: string
        hovered: boolean
    }

    const gameSession = getGameSession()
    let routeOverlayReady = $state(false)

    onMount(() => {
        routeOverlayReady = true
    })

    const companyById: Map<string, (typeof gameSession.gameState.companies)[number]> = $derived.by(() => {
        return new Map(gameSession.gameState.companies.map((company) => [company.id, company]))
    })

    const cityAreaByCityId: Map<string, string> = $derived.by(() => {
        return new Map(gameSession.gameState.board.cities.map((city) => [city.id, city.area]))
    })

    const hoveredDeliveryRouteKey: string | null = $derived.by(() => {
        return gameSession.hoveredDeliveryShippingChoice?.routeKey ?? null
    })

    const deliveryShippingRouteOverlays: readonly DeliveryShippingRouteOverlay[] = $derived.by(() => {
        if (!routeOverlayReady || gameSession.deliverySelectionStage !== 'shipping') {
            return []
        }

        const overlays: DeliveryShippingRouteOverlay[] = []
        for (const choice of gameSession.deliveryShippingChoices) {
            const company = companyById.get(choice.candidate.shippingCompanyId)
            if (!company) {
                continue
            }

            const cityAreaId = cityAreaByCityId.get(choice.candidate.cityId)
            if (!cityAreaId) {
                continue
            }

            const routePath = buildDeliveryShippingRoutePath({
                cultivatedAreaId: choice.candidate.cultivatedAreaId,
                seaAreaIds: choice.candidate.seaAreaIds,
                cityAreaId
            })
            if (!routePath) {
                continue
            }

            overlays.push({
                routeKey: choice.routeKey,
                path: routePath,
                color: gameSession.colors.getPlayerUiColor(company.owner),
                hovered: choice.routeKey === hoveredDeliveryRouteKey
            })
        }

        return overlays
    })

    const BASE_ROUTE_WIDTH = 5.1
    const HOVER_ROUTE_WIDTH = 6.9
    const BASE_ROUTE_UNDERLAY_WIDTH = 7.5
    const HOVER_ROUTE_UNDERLAY_WIDTH = 10.5
</script>

{#if deliveryShippingRouteOverlays.length > 0}
    <g class="select-none pointer-events-none" aria-label="Delivery shipping route overlay">
        {#each deliveryShippingRouteOverlays as route (route.routeKey)}
            <path
                d={route.path}
                fill="none"
                stroke="rgba(255, 251, 240, 0.9)"
                stroke-width={route.hovered ? HOVER_ROUTE_UNDERLAY_WIDTH : BASE_ROUTE_UNDERLAY_WIDTH}
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-dasharray={route.hovered ? '20 12' : '16 12'}
                opacity={route.hovered ? 0.85 : 0.6}
            />
            <path
                d={route.path}
                fill="none"
                stroke={route.color}
                stroke-width={route.hovered ? HOVER_ROUTE_WIDTH : BASE_ROUTE_WIDTH}
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-dasharray={route.hovered ? '20 12' : '16 12'}
                opacity={route.hovered ? 1 : 0.82}
            />
        {/each}
    </g>
{/if}


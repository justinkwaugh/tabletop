<script lang="ts">
    import { onMount } from 'svelte'
    import {
        CompanyType,
        IndonesiaNeighborDirection,
        isIndonesiaNodeId
    } from '@tabletop/indonesia'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { buildDeliveryShippingRoutePath } from '$lib/utils/shippingRouteOverlay.js'
    import { markerPointsForSeaAreaShipList } from '$lib/utils/shipMarkers.js'
    import type { Point } from '@tabletop/common'

    type DeliveryShippingRouteOverlay = {
        routeKey: string
        path: string
        color: string
        hovered: boolean
    }

    type HoveredDeliveryRoute = {
        routeKey: string
        shippingCompanyId: string
        cityId: string
        zoneId: string
        cultivatedAreaId: string
        seaAreaIds: readonly string[]
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

    function pointDistance(a: Point, b: Point): number {
        return Math.hypot(a.x - b.x, a.y - b.y)
    }

    function firstShipWaypointCandidatesForRoute(
        route: Pick<HoveredDeliveryRoute, 'shippingCompanyId' | 'seaAreaIds'>
    ): readonly Point[] | undefined {
        const firstSeaAreaId = route.seaAreaIds[0]
        if (!firstSeaAreaId) {
            return undefined
        }

        const firstSeaArea = gameSession.gameState.board.areas[firstSeaAreaId]
        if (!firstSeaArea || !('ships' in firstSeaArea) || firstSeaArea.ships.length === 0) {
            return undefined
        }

        const markerPoints = markerPointsForSeaAreaShipList(firstSeaAreaId, firstSeaArea.ships)
        if (markerPoints.length === 0) {
            return undefined
        }

        const companyMarkerPoints: Point[] = []
        for (let markerIndex = 0; markerIndex < markerPoints.length; markerIndex += 1) {
            if (firstSeaArea.ships[markerIndex] !== route.shippingCompanyId) {
                continue
            }
            companyMarkerPoints.push(markerPoints[markerIndex])
        }
        if (companyMarkerPoints.length === 0) {
            return undefined
        }
        return companyMarkerPoints
    }

    function seaWaypointOverridesForRoute(
        route: Pick<HoveredDeliveryRoute, 'shippingCompanyId' | 'seaAreaIds'>
    ): Readonly<Record<string, Point>> | undefined {
        const overrides: Record<string, Point> = {}
        let previousPoint: Point | null = null

        for (const seaAreaId of route.seaAreaIds) {
            const seaArea = gameSession.gameState.board.areas[seaAreaId]
            if (!seaArea || !('ships' in seaArea) || seaArea.ships.length === 0) {
                continue
            }

            const markerPoints = markerPointsForSeaAreaShipList(seaAreaId, seaArea.ships)
            if (markerPoints.length === 0) {
                continue
            }

            const companyMarkerPoints: Point[] = []
            for (
                let markerIndex = 0;
                markerIndex < Math.min(markerPoints.length, seaArea.ships.length);
                markerIndex += 1
            ) {
                if (seaArea.ships[markerIndex] !== route.shippingCompanyId) {
                    continue
                }
                companyMarkerPoints.push(markerPoints[markerIndex])
            }
            if (companyMarkerPoints.length === 0) {
                continue
            }

            let selectedPoint = companyMarkerPoints[0]
            if (previousPoint) {
                for (const markerPoint of companyMarkerPoints) {
                    if (pointDistance(markerPoint, previousPoint) < pointDistance(selectedPoint, previousPoint)) {
                        selectedPoint = markerPoint
                    }
                }
            }

            overrides[seaAreaId] = selectedPoint
            previousPoint = selectedPoint
        }

        return Object.keys(overrides).length > 0 ? overrides : undefined
    }

    const blockedShipPointsByShippingCompanyId: Map<string, Point[]> = $derived.by(() => {
        const blockedByCompanyId = new Map<string, Point[]>()
        const shippingCompanyIds = new Set(
            gameSession.gameState.companies
                .filter((company) => company.type === CompanyType.Shipping)
                .map((company) => company.id)
        )

        for (const selectedShippingCompanyId of shippingCompanyIds) {
            blockedByCompanyId.set(selectedShippingCompanyId, [])
        }

        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('ships' in area) || area.ships.length === 0) {
                continue
            }

            const markerPoints = markerPointsForSeaAreaShipList(area.id, area.ships)
            const markerCount = Math.min(area.ships.length, markerPoints.length)
            for (let markerIndex = 0; markerIndex < markerCount; markerIndex += 1) {
                const shipCompanyId = area.ships[markerIndex]
                const markerPoint = markerPoints[markerIndex]
                for (const selectedShippingCompanyId of shippingCompanyIds) {
                    if (shipCompanyId === selectedShippingCompanyId) {
                        continue
                    }
                    const blockedPoints = blockedByCompanyId.get(selectedShippingCompanyId)
                    if (!blockedPoints) {
                        continue
                    }
                    blockedPoints.push(markerPoint)
                }
            }
        }

        return blockedByCompanyId
    })

    const cultivatedAreaIdsByZoneId: Map<string, string[]> = $derived.by(() => {
        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return new Map()
        }

        const cultivatedAreaIdSet = new Set<string>()
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area)) {
                continue
            }
            if (area.companyId !== operatingCompanyId) {
                continue
            }
            cultivatedAreaIdSet.add(area.id)
        }

        const unvisited = [...cultivatedAreaIdSet].sort((left, right) => left.localeCompare(right))
        const zoneAreaIdGroups: string[][] = []
        while (unvisited.length > 0) {
            const seedAreaId = unvisited.shift()
            if (!seedAreaId) {
                continue
            }

            const remaining = new Set(unvisited)
            remaining.delete(seedAreaId)

            const queue: string[] = [seedAreaId]
            const zoneAreaIds: string[] = []
            while (queue.length > 0) {
                const areaId = queue.shift()
                if (!areaId) {
                    continue
                }
                zoneAreaIds.push(areaId)
                if (!isIndonesiaNodeId(areaId)) {
                    continue
                }

                const node = gameSession.gameState.board.graph.nodeById(areaId)
                if (!node) {
                    continue
                }

                for (const neighborNode of gameSession.gameState.board.graph.neighborsOf(
                    node,
                    IndonesiaNeighborDirection.Land
                )) {
                    if (!remaining.has(neighborNode.id)) {
                        continue
                    }
                    remaining.delete(neighborNode.id)
                    queue.push(neighborNode.id)
                }
            }

            unvisited.splice(
                0,
                unvisited.length,
                ...[...remaining].sort((left, right) => left.localeCompare(right))
            )
            zoneAreaIdGroups.push(zoneAreaIds.sort((left, right) => left.localeCompare(right)))
        }

        const areaIdsByZoneId = new Map<string, string[]>()
        const sortedZoneAreaGroups = [...zoneAreaIdGroups].sort((left, right) =>
            (left[0] ?? '').localeCompare(right[0] ?? '')
        )
        sortedZoneAreaGroups.forEach((areaIds, index) => {
            areaIdsByZoneId.set(`${operatingCompanyId}:zone:${index + 1}`, areaIds)
        })

        return areaIdsByZoneId
    })

    const hoveredDeliveryRoute: HoveredDeliveryRoute | null = $derived.by(() => {
        const plannedRoute = gameSession.hoveredPlannedDeliveryRoute
        if (plannedRoute) {
            const zoneAreaIds = cultivatedAreaIdsByZoneId.get(plannedRoute.zoneId)
            return {
                routeKey: `planned:${plannedRoute.shippingCompanyId}|${plannedRoute.cityId}|${plannedRoute.zoneId}|${plannedRoute.seaAreaIds.join('>')}`,
                shippingCompanyId: plannedRoute.shippingCompanyId,
                cityId: plannedRoute.cityId,
                zoneId: plannedRoute.zoneId,
                cultivatedAreaId:
                    plannedRoute.cultivatedAreaId ?? zoneAreaIds?.[0] ?? plannedRoute.zoneId,
                seaAreaIds: plannedRoute.seaAreaIds
            }
        }

        const hoveredChoice = gameSession.hoveredDeliveryShippingChoice
        if (hoveredChoice) {
            return {
                routeKey: hoveredChoice.routeKey,
                shippingCompanyId: hoveredChoice.candidate.shippingCompanyId,
                cityId: hoveredChoice.candidate.cityId,
                zoneId: hoveredChoice.candidate.zoneId,
                cultivatedAreaId: hoveredChoice.candidate.cultivatedAreaId,
                seaAreaIds: hoveredChoice.candidate.seaAreaIds
            }
        }

        return null
    })

    const deliveryShippingRouteOverlays: readonly DeliveryShippingRouteOverlay[] = $derived.by(() => {
        if (!routeOverlayReady || !hoveredDeliveryRoute) {
            return []
        }

        const company = companyById.get(hoveredDeliveryRoute.shippingCompanyId)
        if (!company) {
            return []
        }

        const cityAreaId = cityAreaByCityId.get(hoveredDeliveryRoute.cityId)
        if (!cityAreaId) {
            return []
        }

        const routePath = buildDeliveryShippingRoutePath({
            cultivatedAreaId: hoveredDeliveryRoute.cultivatedAreaId,
            cultivatedZoneAreaIds: cultivatedAreaIdsByZoneId.get(hoveredDeliveryRoute.zoneId),
            firstSeaWaypointCandidates: firstShipWaypointCandidatesForRoute(hoveredDeliveryRoute),
            seaWaypointOverridesByAreaId: seaWaypointOverridesForRoute(hoveredDeliveryRoute),
            blockedShipPoints: blockedShipPointsByShippingCompanyId.get(
                hoveredDeliveryRoute.shippingCompanyId
            ),
            seaAreaIds: hoveredDeliveryRoute.seaAreaIds,
            cityAreaId
        })
        if (!routePath) {
            return []
        }

        return [
            {
                routeKey: hoveredDeliveryRoute.routeKey,
                path: routePath,
                color: gameSession.colors.getPlayerUiColor(company.owner),
                hovered: true
            }
        ]
    })

    const BASE_ROUTE_WIDTH = 7.65
    const HOVER_ROUTE_WIDTH = 10.35
    const BASE_ROUTE_UNDERLAY_WIDTH = 11.25
    const HOVER_ROUTE_UNDERLAY_WIDTH = 15.75
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
                stroke-dasharray={route.hovered ? '20 14' : '16 14'}
                opacity={route.hovered ? 0.85 : 0.6}
            />
            <path
                d={route.path}
                fill="none"
                stroke={route.color}
                stroke-width={route.hovered ? HOVER_ROUTE_WIDTH : BASE_ROUTE_WIDTH}
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-dasharray={route.hovered ? '20 14' : '16 14'}
                opacity={route.hovered ? 1 : 0.82}
            />
        {/each}
    </g>
{/if}

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

    function firstShipWaypointCandidatesForChoice(
        choice: (typeof gameSession.deliveryShippingChoices)[number]
    ): readonly Point[] | undefined {
        const firstSeaAreaId = choice.candidate.seaAreaIds[0]
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
            if (firstSeaArea.ships[markerIndex] !== choice.candidate.shippingCompanyId) {
                continue
            }
            companyMarkerPoints.push(markerPoints[markerIndex])
        }
        if (companyMarkerPoints.length === 0) {
            return undefined
        }
        return companyMarkerPoints
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
                cultivatedZoneAreaIds: cultivatedAreaIdsByZoneId.get(choice.candidate.zoneId),
                firstSeaWaypointCandidates: firstShipWaypointCandidatesForChoice(choice),
                blockedShipPoints: blockedShipPointsByShippingCompanyId.get(
                    choice.candidate.shippingCompanyId
                ),
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

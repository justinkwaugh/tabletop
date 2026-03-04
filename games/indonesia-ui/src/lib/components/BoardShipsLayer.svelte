<script lang="ts">
import ShipMarker from '$lib/components/ShipMarker.svelte'
import { getGameSession } from '$lib/model/sessionContext.svelte'
import { shadeHexColor } from '$lib/utils/color.js'
import { shippingStyleByCompanyId, type ShippingStyle } from '$lib/utils/shippingStyles.js'
import { markerPointsForSeaAreaShipList } from '$lib/utils/shipMarkers.js'
import { Color } from '@tabletop/common'
import { CompanyType, isIndonesiaNodeId } from '@tabletop/indonesia'

    type ShipMarkerEntry = {
        key: string
        companyId: string
        x: number
        y: number
        style: ShippingStyle
        ownerColor: string
        ownerStrokeColor: string
        remainingCapacity?: number
        capacityBadgeTextColor: string
    }

    const gameSession = getGameSession()

    const SHIP_MARKER_HEIGHT = 45
    const SHIP_MARKER_HEIGHT_HOVERED = 54
    const DIMMED_SHIP_OPACITY = 0.32
    const HOVERED_OUTLINE_COLOR = '#fff7cc'
    const SHIP_MARKER_HULL_STROKE_WIDTH = 10
    const SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW = 0.16
    const SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE = 0.12

    const companyById: Map<string, (typeof gameSession.gameState.companies)[number]> = $derived.by(
        () => new Map(gameSession.gameState.companies.map((company) => [company.id, company]))
    )

    const hoveredShippingCompanyId: string | null = $derived.by(() => {
        const hoveredCompanyId = gameSession.hoveredOperatingCompanyId
        if (!hoveredCompanyId) {
            return null
        }
        const hoveredCompany = companyById.get(hoveredCompanyId)
        if (!hoveredCompany || hoveredCompany.type !== CompanyType.Shipping) {
            return null
        }
        return hoveredCompany.id
    })

    const spotlightedShippingCompanyIds: string[] = $derived.by(() => {
        const spotlightIds: string[] = []
        for (const companyId of gameSession.hoveredCompanySpotlightCompanyIds) {
            const company = companyById.get(companyId)
            if (!company || company.type !== CompanyType.Shipping) {
                continue
            }
            if (spotlightIds.includes(company.id)) {
                continue
            }
            spotlightIds.push(company.id)
        }
        return spotlightIds
    })

    const activeShipSpotlightCompanyIds: string[] = $derived.by(() => {
        if (spotlightedShippingCompanyIds.length > 0) {
            return spotlightedShippingCompanyIds
        }
        if (hoveredShippingCompanyId) {
            return [hoveredShippingCompanyId]
        }
        return []
    })

    const activeShipSpotlightCompanyIdSet: ReadonlySet<string> = $derived.by(
        () => new Set(activeShipSpotlightCompanyIds)
    )

    const styleByShippingCompanyId = $derived.by(() => shippingStyleByCompanyId(gameSession.gameState))

    const shipMarkers: ShipMarkerEntry[] = $derived.by(() => {
        const markers: ShipMarkerEntry[] = []

        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('ships' in area) || area.ships.length === 0) {
                continue
            }

            const points = markerPointsForSeaAreaShipList(area.id, area.ships)
            const markerCount = Math.min(area.ships.length, points.length)
            const companyShipOrdinalById = new Map<string, number>()
            for (let markerIndex = 0; markerIndex < markerCount; markerIndex += 1) {
                const companyId = area.ships[markerIndex]
                const company = companyById.get(companyId)
                if (!company) {
                    continue
                }
                const companyShipOrdinal = companyShipOrdinalById.get(companyId) ?? 0
                companyShipOrdinalById.set(companyId, companyShipOrdinal + 1)

                const markerPoint = points[markerIndex]
                const ownerColor = gameSession.colors.getPlayerUiColor(company.owner)
                const ownerPlayerColor = gameSession.colors.getPlayerColor(company.owner)
                let remainingCapacity: number | undefined
                if (company.type === CompanyType.Shipping && isIndonesiaNodeId(area.id)) {
                    const ownerHullLevel = gameSession.gameState.getPlayerState(company.owner).research.hull
                    const capacityPerShip = 1 + ownerHullLevel
                    const usedCapacity = gameSession.gameState.operatingCompanyShipUseCount(
                        company.id,
                        area.id
                    )
                    remainingCapacity = Math.max(
                        0,
                        Math.min(
                            capacityPerShip,
                            (companyShipOrdinal + 1) * capacityPerShip - usedCapacity
                        )
                    )
                }

                markers.push({
                    key: `${area.id}-${companyId}-${markerIndex}`,
                    companyId,
                    x: markerPoint.x,
                    y: markerPoint.y,
                    style: styleByShippingCompanyId.get(company.id) ?? 'a',
                    ownerColor,
                    remainingCapacity,
                    capacityBadgeTextColor:
                        ownerPlayerColor === Color.Yellow ? '#111827' : '#f8fafc',
                    ownerStrokeColor:
                        ownerPlayerColor === Color.Yellow
                            ? shadeHexColor(
                                  ownerColor,
                                  SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW
                              )
                            : ownerPlayerColor === Color.Blue
                              ? shadeHexColor(
                                    ownerColor,
                                    SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE
                                )
                            : 'none'
                })
            }
        }

        return markers
    })

    const dimmedShipMarkers: ShipMarkerEntry[] = $derived.by(() => {
        if (activeShipSpotlightCompanyIdSet.size === 0) {
            return shipMarkers
        }
        return shipMarkers.filter((ship) => !activeShipSpotlightCompanyIdSet.has(ship.companyId))
    })

    const emphasizedShipMarkers: ShipMarkerEntry[] = $derived.by(() => {
        if (activeShipSpotlightCompanyIdSet.size === 0) {
            return []
        }
        return shipMarkers.filter((ship) => activeShipSpotlightCompanyIdSet.has(ship.companyId))
    })
</script>

<g class="pointer-events-none select-none" aria-label="Ships layer">
    {#each dimmedShipMarkers as ship (ship.key)}
        <g opacity={activeShipSpotlightCompanyIdSet.size > 0 ? DIMMED_SHIP_OPACITY : 1}>
            <ShipMarker
                x={ship.x}
                y={ship.y}
                style={ship.style}
                height={SHIP_MARKER_HEIGHT}
                outline={false}
                hullFillColor={ship.ownerColor}
                hullStrokeColor={ship.ownerStrokeColor}
                hullStrokeWidth={SHIP_MARKER_HULL_STROKE_WIDTH}
                capacityBadgeValue={ship.remainingCapacity}
                capacityBadgeFillColor={ship.ownerColor}
                capacityBadgeTextColor={ship.capacityBadgeTextColor}
            />
        </g>
    {/each}

    {#if activeShipSpotlightCompanyIdSet.size > 0}
        {#each emphasizedShipMarkers as ship (ship.key)}
            <ShipMarker
                x={ship.x}
                y={ship.y}
                style={ship.style}
                height={SHIP_MARKER_HEIGHT_HOVERED}
                outline={true}
                outlineColor={HOVERED_OUTLINE_COLOR}
                hullFillColor={ship.ownerColor}
                hullStrokeColor={ship.ownerStrokeColor}
                hullStrokeWidth={SHIP_MARKER_HULL_STROKE_WIDTH}
                capacityBadgeValue={ship.remainingCapacity}
                capacityBadgeFillColor={ship.ownerColor}
                capacityBadgeTextColor={ship.capacityBadgeTextColor}
            />
        {/each}
    {/if}
</g>

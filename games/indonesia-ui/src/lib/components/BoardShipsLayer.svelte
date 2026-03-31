<script lang="ts">
import { animateStartedShipMarker } from '$lib/animators/startCompanyAnimator.js'
import {
    animateMergedShipMarker,
    attachShipMergerAnimator,
    ShipMergerAnimator
} from '$lib/animators/shipMergerAnimator.js'
import ShipMarker from '$lib/components/ShipMarker.svelte'
import { getStartCompanyAnimatorContext } from '$lib/model/startCompanyAnimatorContext.svelte.js'
import { getGameSession } from '$lib/model/sessionContext.svelte'
import {
    expandedShipMarkerEntryForAction,
    startedShipMarkerEntryForAction
} from '$lib/utils/startedCompanyEntries.js'
import { shadeHexColor } from '$lib/utils/color.js'
import { shipSlotKey } from '$lib/utils/shipSlotKey.js'
import { shippingStyleByCompanyId, type ShippingStyle } from '$lib/utils/shippingStyles.js'
import { markerPointsForSeaAreaShipList } from '$lib/utils/shipMarkers.js'
import { Color } from '@tabletop/common'
import { CompanyType, isIndonesiaNodeId } from '@tabletop/indonesia'

    type ShipMarkerEntry = {
        key: string
        areaId: string
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
    const startCompanyAnimator = getStartCompanyAnimatorContext()
    const shipMergerAnimator = new ShipMergerAnimator(gameSession)

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

    const activeShipVisualState = $derived(gameSession.activeShipVisualState)

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
                    key: shipSlotKey(area.id, markerIndex),
                    areaId: area.id,
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
        if (activeShipVisualState.source === 'route-preview') {
            return []
        }
        if (activeShipVisualState.source === 'none') {
            return shipMarkers
        }
        return shipMarkers.filter(
            (ship) => !activeShipVisualState.emphasizedCompanyIdSet.has(ship.companyId)
        )
    })

    const emphasizedShipMarkers: ShipMarkerEntry[] = $derived.by(() => {
        if (activeShipVisualState.source === 'route-preview') {
            return shipMarkers.filter(
                (ship) =>
                    ship.companyId === activeShipVisualState.shippingCompanyId &&
                    activeShipVisualState.seaAreaIdSet.has(ship.areaId)
            )
        }
        if (activeShipVisualState.source === 'none') {
            return []
        }
        return shipMarkers.filter((ship) =>
            activeShipVisualState.emphasizedCompanyIdSet.has(ship.companyId)
        )
    })

    const shouldRenderEmphasizedShips: boolean = $derived.by(() => {
        return activeShipVisualState.source !== 'none'
    })

    const startedShipMarkers = $derived.by(() => {
        return gameSession.visibleStartedCompanyAnimationEntries
            .flatMap((entry) =>
                startedShipMarkerEntryForAction({
                    gameState: gameSession.gameState,
                    action: entry.action,
                    ownerColorForPlayerId: (playerId) => gameSession.colors.getPlayerUiColor(playerId),
                    ownerPlayerColorForPlayerId: (playerId) => gameSession.colors.getPlayerColor(playerId)
                })
            )
    })

    const expandedShipMarkers = $derived.by(() => {
        return gameSession.visibleExpandAnimationEntries
            .flatMap((entry) =>
                expandedShipMarkerEntryForAction({
                    gameState: gameSession.gameState,
                    action: entry.action,
                    ownerColorForPlayerId: (playerId) => gameSession.colors.getPlayerUiColor(playerId),
                    ownerPlayerColorForPlayerId: (playerId) => gameSession.colors.getPlayerColor(playerId)
                })
            )
    })

    const mergedShipMarkers = $derived.by(() => gameSession.visibleShippingMergeAnimationEntries)

    const animatedShipMarkers = $derived.by(() => [...startedShipMarkers, ...expandedShipMarkers])
    const suppressedBaseShipKeySet: ReadonlySet<string> = $derived.by(
        () =>
            new Set(
                [...animatedShipMarkers, ...mergedShipMarkers].flatMap((ship) =>
                    ship.baseShipKey ? [ship.baseShipKey] : []
                )
            )
    )

    const visibleDimmedShipMarkers: ShipMarkerEntry[] = $derived.by(() =>
        dimmedShipMarkers.filter((ship) => !suppressedBaseShipKeySet.has(ship.key))
    )

    const visibleEmphasizedShipMarkers: ShipMarkerEntry[] = $derived.by(() =>
        emphasizedShipMarkers.filter((ship) => !suppressedBaseShipKeySet.has(ship.key))
    )

</script>

<g
    class="pointer-events-none select-none"
    aria-label="Ships layer"
    {@attach attachShipMergerAnimator(shipMergerAnimator)}
>
    {#each visibleDimmedShipMarkers as ship (ship.key)}
        <g opacity={activeShipVisualState.source === 'company-spotlight' ? DIMMED_SHIP_OPACITY : 1}>
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

    {#if shouldRenderEmphasizedShips}
        {#each visibleEmphasizedShipMarkers as ship (ship.key)}
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

    {#each animatedShipMarkers as ship (ship.key)}
        <g
            opacity="0"
            use:animateStartedShipMarker={{
                animator: startCompanyAnimator,
                animationKey: ship.animationKey,
                fromX: ship.fromX,
                fromY: ship.fromY,
                toX: ship.toX,
                toY: ship.toY,
                role: ship.animationRole
            }}
        >
            <ShipMarker
                x={0}
                y={0}
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

    {#each mergedShipMarkers as ship (ship.key)}
        <g
            opacity="0"
            use:animateMergedShipMarker={{
                animator: shipMergerAnimator,
                animationKey: ship.animationKey,
                x: ship.x,
                y: ship.y,
                role: ship.animationRole
            }}
        >
            <ShipMarker
                x={0}
                y={0}
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
</g>

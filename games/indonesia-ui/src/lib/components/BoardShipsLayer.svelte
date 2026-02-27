<script lang="ts">
    import ShipMarker from '$lib/components/ShipMarker.svelte'
    import { SEA_SHIP_MARKER_POSITIONS } from '$lib/definitions/seaShipMarkerPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { shadeHexColor } from '$lib/utils/color.js'
    import { Color } from '@tabletop/common'
    import { CompanyType, MachineState } from '@tabletop/indonesia'

    type ShipMarkerEntry = {
        key: string
        x: number
        y: number
        style: 'a' | 'b'
        ownerColor: string
        ownerStrokeColor: string
        remainingCapacity?: number
        capacityBadgeTextColor: string
    }

    const gameSession = getGameSession()

    const SHIP_MARKER_HEIGHT = 45
    const SHIP_MARKER_HULL_STROKE_WIDTH = 10
    const SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT = 0.35

    function layoutCountForShips(shipCount: number): 1 | 2 | 3 {
        if (shipCount <= 1) {
            return 1
        }
        if (shipCount === 2) {
            return 2
        }
        return 3
    }

    const companyById: Map<string, (typeof gameSession.gameState.companies)[number]> = $derived.by(
        () => new Map(gameSession.gameState.companies.map((company) => [company.id, company]))
    )
    const showRemainingCapacityBadges = $derived(
        gameSession.gameState.machineState === MachineState.ProductionOperations
    )

    const shipMarkers: ShipMarkerEntry[] = $derived.by(() => {
        const markers: ShipMarkerEntry[] = []

        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('ships' in area) || area.ships.length === 0) {
                continue
            }

            const layout = SEA_SHIP_MARKER_POSITIONS[area.id]
            if (!layout) {
                continue
            }

            const points = layout[layoutCountForShips(area.ships.length)]
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
                if (showRemainingCapacityBadges && company.type === CompanyType.Shipping) {
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
                    x: markerPoint.x,
                    y: markerPoint.y,
                    style: markerIndex % 2 === 0 ? 'a' : 'b',
                    ownerColor,
                    remainingCapacity,
                    capacityBadgeTextColor:
                        ownerPlayerColor === Color.Yellow ? '#111827' : '#f8fafc',
                    ownerStrokeColor:
                        ownerPlayerColor === Color.Yellow
                            ? shadeHexColor(ownerColor, SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT)
                            : 'none'
                })
            }
        }

        return markers
    })
</script>

<g class="pointer-events-none select-none" aria-label="Ships layer">
    {#each shipMarkers as ship (ship.key)}
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
    {/each}
</g>

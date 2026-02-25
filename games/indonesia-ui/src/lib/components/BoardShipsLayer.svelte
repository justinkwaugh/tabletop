<script lang="ts">
    import ShipMarker from '$lib/components/ShipMarker.svelte'
    import { SEA_SHIP_MARKER_POSITIONS } from '$lib/definitions/seaShipMarkerPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { shadeHexColor } from '$lib/utils/color.js'
    import { Color } from '@tabletop/common'

    type ShipMarkerEntry = {
        key: string
        x: number
        y: number
        style: 'a' | 'b'
        ownerColor: string
        ownerStrokeColor: string
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
            for (let markerIndex = 0; markerIndex < markerCount; markerIndex += 1) {
                const companyId = area.ships[markerIndex]
                const company = companyById.get(companyId)
                if (!company) {
                    continue
                }

                const markerPoint = points[markerIndex]
                const ownerColor = gameSession.colors.getPlayerUiColor(company.owner)
                const ownerPlayerColor = gameSession.colors.getPlayerColor(company.owner)
                markers.push({
                    key: `${area.id}-${companyId}-${markerIndex}`,
                    x: markerPoint.x,
                    y: markerPoint.y,
                    style: markerIndex % 2 === 0 ? 'a' : 'b',
                    ownerColor,
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
        />
    {/each}
</g>

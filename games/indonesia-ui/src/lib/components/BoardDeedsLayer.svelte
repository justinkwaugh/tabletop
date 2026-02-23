<script lang="ts">
    import {
        BOARD_AREA_PATH_BY_ID,
        EAST_ISLAND_AREAS,
        EASTCENTRAL_ISLAND_AREAS,
        LEFTMOST_ISLAND_AREAS,
        NORTHEAST_ISLAND_AREAS,
        SOUTHCHAIN_ISLAND_AREAS,
        SOUTHLEFT_ISLAND_AREAS,
        TOP_CENTER_ISLAND_AREAS
    } from '$lib/definitions/boardGeometry.js'
    import Area from '$lib/components/Area.svelte'
    import CompanyCard from '$lib/components/CompanyCard.svelte'
    import { DEED_CARD_POSITIONS } from '$lib/definitions/deedCardPositions.js'
    import { LAND_MARKER_POSITIONS } from '$lib/definitions/landMarkerPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { CompanyType, Era, Good, INDONESIA_REGIONS } from '@tabletop/indonesia'

    const gameSession = getGameSession()

    type Point = {
        x: number
        y: number
    }

    type CardKind = 'rice' | 'spice' | 'rubber' | 'oil' | 'ship'

    type DeedRenderEntry = {
        key: string
        regionId: string
        regionName: string
        cardKind: CardKind
        shippingSizes: readonly ShippingSizeEntry[] | null
        cardX: number
        cardY: number
        overlayFill: string
        overlayStroke: string
        overlayOpacity: number
        overlayAreaIds: string[]
    }

    const SHIPPING_ERA_ORDER = [Era.A, Era.B, Era.C] as const
    type ShippingSizeEntry = {
        era: (typeof SHIPPING_ERA_ORDER)[number]
        size: number
    }

    type OverlayArea = {
        key: string
        areaId: string
        fill: string
        stroke: string
        opacity: number
    }

    type DeedVisual = {
        cardKind: CardKind
        overlayFill: string
        overlayStroke: string
        overlayOpacity: number
    }

    type DeedOverlayAdjustment = {
        darknessShift?: number
    }

    const CARD_HEIGHT = 58
    const CARD_BASE_OFFSET_X = 76
    const CARD_BASE_OFFSET_Y = -92

    const LAND_AREA_PATHS = [
        ...LEFTMOST_ISLAND_AREAS,
        ...SOUTHLEFT_ISLAND_AREAS,
        ...TOP_CENTER_ISLAND_AREAS,
        ...EASTCENTRAL_ISLAND_AREAS,
        ...SOUTHCHAIN_ISLAND_AREAS,
        ...NORTHEAST_ISLAND_AREAS,
        ...EAST_ISLAND_AREAS
    ]

    const LAND_MARKER_POSITION_LOOKUP = LAND_MARKER_POSITIONS as Record<string, Point>
    const REGION_NAME_BY_ID = new Map(INDONESIA_REGIONS.map((region) => [region.id, region.name]))

    const RICE_VISUAL: DeedVisual = {
        cardKind: 'rice',
        overlayFill: '#e3d8c0',
        overlayStroke: '#6c5a46',
        overlayOpacity: 0.8
    }

    const SPICE_VISUAL: DeedVisual = {
        cardKind: 'spice',
        overlayFill: '#d5e1b1',
        overlayStroke: '#425735',
        overlayOpacity: 0.8
    }

    const RUBBER_VISUAL: DeedVisual = {
        cardKind: 'rubber',
        overlayFill: '#c1bdbb',
        overlayStroke: '#131113',
        overlayOpacity: 0.8
    }

    const OIL_VISUAL: DeedVisual = {
        cardKind: 'oil',
        overlayFill: '#baa8ca',
        overlayStroke: '#23344f',
        overlayOpacity: 0.8
    }

    const SHIPPING_VISUAL: DeedVisual = {
        cardKind: 'ship',
        overlayFill: '#9fc4c5',
        overlayStroke: '#396c78',
        overlayOpacity: 0.4
    }

    const DEED_OVERLAY_ADJUSTMENTS: Record<string, DeedOverlayAdjustment> = {
        'R08:Shipping': { darknessShift: 0.15 },
        'R14:Shipping': { darknessShift: 0.15 },
        'R26:Production': { darknessShift: 0.1 }
    }

    const PRODUCTION_VISUAL_BY_GOOD: Record<Good, DeedVisual> = {
        [Good.Rice]: RICE_VISUAL,
        [Good.Spice]: SPICE_VISUAL,
        [Good.Rubber]: RUBBER_VISUAL,
        [Good.Oil]: OIL_VISUAL,
        [Good.SiapSaji]: SPICE_VISUAL
    }

    function toRoundedValue(value: number): number {
        return Math.round(value * 10) / 10
    }

    function deedPositionKey(regionId: string, deedType: CompanyType): string {
        return `${regionId}:${deedType}`
    }

    function shadeHexColor(hex: string, darknessShift: number): string {
        const normalized = hex.trim().replace('#', '')
        if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
            return hex
        }

        const shift = Math.max(-0.9, Math.min(0.9, darknessShift))
        const channels = [0, 2, 4].map((offset) =>
            Number.parseInt(normalized.slice(offset, offset + 2), 16)
        )

        const shifted = channels.map((channel) => {
            if (shift >= 0) {
                return Math.round(channel * (1 - shift))
            }
            return Math.round(channel + (255 - channel) * -shift)
        })

        const toHex = (value: number) => value.toString(16).padStart(2, '0')
        return `#${toHex(shifted[0])}${toHex(shifted[1])}${toHex(shifted[2])}`
    }

    function resolveDeedOverlayVisual(
        regionId: string,
        deedType: CompanyType,
        baseVisual: DeedVisual
    ): DeedVisual {
        const adjustment = DEED_OVERLAY_ADJUSTMENTS[deedPositionKey(regionId, deedType)]
        if (!adjustment?.darknessShift) {
            return baseVisual
        }

        return {
            ...baseVisual,
            overlayFill: shadeHexColor(baseVisual.overlayFill, adjustment.darknessShift),
            overlayStroke: shadeHexColor(baseVisual.overlayStroke, adjustment.darknessShift * 0.7)
        }
    }

    function getPathLabelPosition(path: string): Point {
        const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY

        for (let i = 0; i < values.length - 1; i += 2) {
            const x = values[i]
            const y = values[i + 1]
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
        }

        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        }
    }

    function resolveDeedCardPosition(
        regionId: string,
        deedType: CompanyType,
        regionCenter: Point
    ): Point {
        const tunedPosition = DEED_CARD_POSITIONS[deedPositionKey(regionId, deedType)]
        if (
            tunedPosition &&
            typeof tunedPosition.x === 'number' &&
            typeof tunedPosition.y === 'number'
        ) {
            return {
                x: toRoundedValue(tunedPosition.x),
                y: toRoundedValue(tunedPosition.y)
            }
        }

        return {
            x: regionCenter.x + CARD_BASE_OFFSET_X,
            y: regionCenter.y + CARD_BASE_OFFSET_Y
        }
    }

    function shippingSizeEntriesFromRecord(
        sizes: Partial<Record<(typeof SHIPPING_ERA_ORDER)[number], number>>
    ): readonly ShippingSizeEntry[] {
        return SHIPPING_ERA_ORDER.flatMap((era) => {
            const size = sizes[era]
            if (typeof size !== 'number') {
                return []
            }
            return [{ era, size }]
        })
    }

    const LAND_AREA_CENTER_BY_ID = new Map<string, Point>(
        LAND_AREA_PATHS.map((area) => [area.id, getPathLabelPosition(area.path)])
    )

    const REGION_LAND_AREA_IDS = new Map<string, string[]>(
        INDONESIA_REGIONS.map((region) => [region.id, [...region.areaIds]])
    )

    const REGION_CENTER_BY_ID: Map<string, Point> = $derived.by(() => {
        const centers = new Map<string, Point>()
        for (const [regionId, areaIds] of REGION_LAND_AREA_IDS.entries()) {
            const points: Point[] = []
            for (const areaId of areaIds) {
                const markerPoint = LAND_MARKER_POSITION_LOOKUP[areaId]
                if (markerPoint) {
                    points.push(markerPoint)
                    continue
                }
                const fallbackPoint = LAND_AREA_CENTER_BY_ID.get(areaId)
                if (fallbackPoint) {
                    points.push(fallbackPoint)
                }
            }
            if (points.length === 0) {
                continue
            }
            const center = points.reduce(
                (acc, point) => {
                    acc.x += point.x
                    acc.y += point.y
                    return acc
                },
                { x: 0, y: 0 }
            )
            centers.set(regionId, {
                x: toRoundedValue(center.x / points.length),
                y: toRoundedValue(center.y / points.length)
            })
        }
        return centers
    })

    const DEED_RENDER_ENTRIES: DeedRenderEntry[] = $derived.by(() => {
        const deeds = gameSession.gameState.availableDeeds

        const entries: DeedRenderEntry[] = []

        for (const deed of deeds) {
            const regionId = deed.region

            const regionAreaIds = REGION_LAND_AREA_IDS.get(regionId) ?? []
            const regionCenter = REGION_CENTER_BY_ID.get(regionId)
            if (!regionCenter) {
                continue
            }

            const cardPosition = resolveDeedCardPosition(regionId, deed.type, regionCenter)

            const regionName = REGION_NAME_BY_ID.get(regionId) ?? regionId

            if (deed.type === CompanyType.Shipping) {
                const visual = resolveDeedOverlayVisual(regionId, deed.type, SHIPPING_VISUAL)
                const seaAreaIds = gameSession.gameState.board
                    .seaAreasForRegion(regionId)
                    .filter((seaAreaId) => BOARD_AREA_PATH_BY_ID.has(seaAreaId))

                entries.push({
                    key: deedPositionKey(regionId, deed.type),
                    regionId,
                    regionName,
                    cardKind: visual.cardKind,
                    shippingSizes: shippingSizeEntriesFromRecord(deed.sizes),
                    cardX: cardPosition.x,
                    cardY: cardPosition.y,
                    overlayFill: visual.overlayFill,
                    overlayStroke: visual.overlayStroke,
                    overlayOpacity: visual.overlayOpacity,
                    overlayAreaIds: seaAreaIds
                })
                continue
            }

            if (deed.type !== CompanyType.Production) {
                continue
            }

            const visual = resolveDeedOverlayVisual(
                regionId,
                deed.type,
                PRODUCTION_VISUAL_BY_GOOD[deed.good]
            )

            entries.push({
                key: deedPositionKey(regionId, deed.type),
                regionId,
                regionName,
                cardKind: visual.cardKind,
                shippingSizes: null,
                cardX: cardPosition.x,
                cardY: cardPosition.y,
                overlayFill: visual.overlayFill,
                overlayStroke: visual.overlayStroke,
                overlayOpacity: visual.overlayOpacity,
                overlayAreaIds: regionAreaIds
            })
        }

        return entries
    })

    const DEED_OVERLAY_AREAS: OverlayArea[] = $derived.by(() => {
        const overlays: OverlayArea[] = []
        for (const deed of DEED_RENDER_ENTRIES) {
            for (const areaId of deed.overlayAreaIds) {
                if (!BOARD_AREA_PATH_BY_ID.has(areaId)) {
                    continue
                }
                overlays.push({
                    key: `${deed.key}-${areaId}`,
                    areaId,
                    fill: deed.overlayFill,
                    stroke: deed.overlayStroke,
                    opacity: deed.overlayOpacity
                })
            }
        }
        return overlays
    })
</script>

<g class="pointer-events-none select-none" aria-label="Available deeds layer">
    {#each DEED_OVERLAY_AREAS as overlay (overlay.key)}
        <Area
            areaId={overlay.areaId}
            fill={overlay.fill}
            stroke={overlay.stroke}
            fillOpacity="1"
            fillRule="evenodd"
            strokeWidth="1.9"
            strokeLineJoin="round"
            strokeLineCap="round"
            opacity={overlay.opacity}
        />
    {/each}

    {#each DEED_RENDER_ENTRIES as deed (deed.key)}
        <CompanyCard
            type={deed.cardKind}
            x={deed.cardX}
            y={deed.cardY}
            height={CARD_HEIGHT}
            text={deed.regionName}
            shippingSizes={deed.shippingSizes}
        />
    {/each}
</g>

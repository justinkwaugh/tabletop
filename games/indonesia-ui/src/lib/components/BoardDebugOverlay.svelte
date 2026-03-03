<script lang="ts">
    import { onMount } from 'svelte'
    import {
        EAST_ISLAND_AREAS,
        EASTCENTRAL_ISLAND_AREAS,
        LEFTMOST_ISLAND_AREAS,
        NORTHEAST_ISLAND_AREAS,
        SEA_AREAS,
        TOP_CENTER_ISLAND_AREAS,
        SOUTHCHAIN_ISLAND_AREAS,
        SOUTHLEFT_ISLAND_AREAS
    } from '$lib/definitions/boardGeometry.js'
    import Area from '$lib/components/Area.svelte'
    import SpiceMarker from '$lib/components/SpiceMarker.svelte'
    import SiapSajiMarker from '$lib/components/SiapSajiMarker.svelte'
    import OilMarker from '$lib/components/OilMarker.svelte'
    import RiceMarker from '$lib/components/RiceMarker.svelte'
    import RubberMarker from '$lib/components/RubberMarker.svelte'
    import CubeMarker from '$lib/components/CubeMarker.svelte'
    import ShipMarker from '$lib/components/ShipMarker.svelte'
    import GlassBeadMarker from '$lib/components/GlassBeadMarker.svelte'
    import CityDemandMarker from '$lib/components/CityDemandMarker.svelte'
    import CompanyZoneMarker from '$lib/components/CompanyZoneMarker.svelte'
    import CompanyDeed, { deedCardKindFor } from '$lib/components/CompanyDeed.svelte'
    import { DEED_CARD_POSITIONS, DEED_CARD_POSITIONS_STORAGE_KEY } from '$lib/definitions/deedCardPositions.js'
    import { LAND_MARKER_POSITIONS } from '$lib/definitions/landMarkerPositions.js'
    import {
        PRODUCTION_ZONE_MARKER_OFFSETS,
        PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY
    } from '$lib/definitions/productionZoneMarkerOffsets.js'
    import { CITY_DEMAND_MARKER_POSITIONS_BY_REGION } from '$lib/definitions/cityDemandMarkerPositions.js'
    import {
        RESEARCH_ROWS,
        RESEARCH_TRACK_CELLS,
        type ResearchRow
    } from '$lib/definitions/researchTrackPositions.js'
    import { getRegionName } from '$lib/definitions/regions.js'
    import { SEA_SHIP_MARKER_POSITIONS } from '$lib/definitions/seaShipMarkerPositions.js'
    import {
        researchCubeHorizontalJitter,
        researchCubeOffsets,
        researchCubeRotationDegrees
    } from '$lib/utils/researchCubeLayout.js'
    import {
        deedPositionLookupKeys,
        deedPositionRenderKey,
        deedPositionKey,
        shippingSizeEntriesFromDeed,
        type ShippingSizeEntry
    } from '$lib/utils/deeds.js'
    import { getPathCenter, roundToTenth } from '$lib/utils/geometry.js'
    import { shadeHexColor } from '$lib/utils/color.js'
    import type { CompanyCardType } from '$lib/types/companyCard.js'
    import type { Point } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { CompanyType, Deeds, Era, Good, INDONESIA_REGIONS, type AnyDeed } from '@tabletop/indonesia'

    const gameSession = getGameSession()

    let {
        width,
        height,
        active = $bindable(false)
    }: { width: number; height: number; active?: boolean } = $props()

    type OverlayMode =
        | 'none'
        | 'land'
        | 'coastal'
        | 'region'
        | 'sea'
        | 'ships'
        | 'deeds'
        | 'production'
        | 'companies'
        | 'research'
        | 'marker'
        | 'companymarkers'
        | 'citydemand'
        | 'layout'
    type BeadTone = 'amber' | 'red' | 'green'
    let colorMode: OverlayMode = $state('none')
    let hoveredSeaId: string | null = $state(null)
    let debugSvgElement: SVGSVGElement | null = $state(null)
    let markerPositions: Record<string, Point> = $state({})
    let markerPositionsLoaded = $state(false)
    let markerSelectedAreaId: string | null = $state(null)
    let markerDraggingAreaId: string | null = $state(null)
    let markerCopyStatus: string | null = $state(null)
    let cityDemandMarkerOffsets: Record<string, Point> = $state({})
    let cityDemandMarkerOffsetsLoaded = $state(false)
    let cityDemandSelectedRegionId: string | null = $state(null)
    let cityDemandDraggingRegionId: string | null = $state(null)
    let cityDemandCopyStatus: string | null = $state(null)
    let shipMarkerCount: 1 | 2 | 3 = $state(1)
    let companyShipMarkerCount: 1 | 2 | 3 = $state(1)
    let shipMarkerPositions: Record<string, SeaShipLayout> = $state({})
    let shipMarkerPositionsLoaded = $state(false)
    let shipMarkerSelectedSeaId: string | null = $state(null)
    let shipMarkerSelectedIndex = $state(0)
    let shipMarkerDragging: { seaId: string; index: number } | null = $state(null)
    let shipMarkerCopyStatus: string | null = $state(null)
    let deedCardPositions: Record<string, Point> = $state({})
    let deedCardPositionsLoaded = $state(false)
    let deedEra: Era = $state(Era.A)
    let selectedDeedCardKey: string | null = $state(null)
    let deedCardDraggingKey: string | null = $state(null)
    let deedCardCopyStatus: string | null = $state(null)
    let productionZoneMarkerOffsets: Record<string, Point> = $state({})
    let productionZoneMarkerOffsetsLoaded = $state(false)
    let selectedProductionZoneMarkerDeedId: string | null = $state(null)
    let productionZoneMarkerDraggingDeedId: string | null = $state(null)
    let productionZoneMarkerCopyStatus: string | null = $state(null)
    let layoutShowShips = $state(true)
    let layoutShowDeeds = $state(true)
    let layoutShowTags = $state(true)
    let layoutShowCityDemand = $state(true)
    let layoutShipCountBySeaId: Record<string, 1 | 2 | 3> = $state({})

    type BoardNodeAreaType = 'Land' | 'Sea'

    type BoardNodeView = {
        id: string
        type: BoardNodeAreaType
        landNeighbors: string[]
        seaNeighbors: string[]
        region: string | null
    }

    type DebugArea = {
        id: string
        path: string
        label: string
        labelX: number
        labelY: number
        region: string | null
    }

    type DebugConnection = {
        id: string
        x1: number
        y1: number
        x2: number
        y2: number
    }

    type RegionLabel = { regionId: string } & Point

    type ProductionMarkerType = 'spice' | 'siapsaji' | 'oil' | 'rice' | 'rubber'
    type ProductionMarkerPlacement = {
        areaId: string
        markerType: ProductionMarkerType | 'bead'
        beadTone?: BeadTone
    } & Point

    type ShipSeaMarker = {
        id: string
        style: 'a' | 'b'
    } & Point

    type SeaShipLayout = {
        1: Point[]
        2: Point[]
        3: Point[]
    }

    type ShipTuneMarker = {
        id: string
        seaId: string
        style: 'a' | 'b'
        index: number
    } & Point

    type CompanyMarkerDirection = 'north' | 'east' | 'south' | 'west'
    type DebugProductionDeedMarkerEntry = {
        key: string
        deedId: string
        regionId: string
        x: number
        y: number
        baseX: number
        baseY: number
        targetX: number
        targetY: number
        ownerColor: string
        goodType: ProductionMarkerType
        goodsCount: number
        hatchPatternId: string | null
        direction: CompanyMarkerDirection
    }

    type DeedTuneEntry = {
        deedId: string
        deedType: CompanyType
        positionKey: string
        legacyPositionKey: string
        regionId: string
        regionName: string
        cardKind: CompanyCardType
        shippingSizes: readonly ShippingSizeEntry[] | null
    } & Point

    type DebugResearchCube = {
        key: string
        x: number
        y: number
        color: string
        rotationDegrees: number
    }

    type CityDemandTuneMarker = {
        key: string
        regionId: string
        areaId: string
        x: number
        y: number
        targetX: number
        targetY: number
        demands: Array<{
            good: Good
            count: number
        }>
    }

    const DEBUG_PALETTE = ['#ff3b30', '#007aff', '#34c759', '#ffcc00', '#af52de', '#ff9500']
    const PRODUCTION_ICON_HEIGHT = 30
    const SHIP_MARKER_HEIGHT = 45
    const GLASS_BEAD_HEIGHT = 46
    const GLASS_BEAD_OPACITY = 0.85
    const DEED_CARD_HEIGHT = 58
    const DEED_CARD_HANDLE_OFFSET = 8
    const COMPANY_OVERLAY_LIGHT = '#e3d8c0'
    const COMPANY_OVERLAY_DARK = '#6c5a46'
    const RUBBER_OVERLAY_LIGHT = '#c1bdbb'
    const RUBBER_OVERLAY_DARK = '#131113'
    const SPICE_OVERLAY_LIGHT = '#d5e1b1'
    const SPICE_OVERLAY_DARK = '#425735'
    const SHIP_OVERLAY_LIGHT = '#9fc4c5'
    const SHIP_OVERLAY_DARK = '#396c78'
    const MARKER_POSITIONS_STORAGE_KEY = 'indonesia-marker-positions-v1'
    const CITY_DEMAND_MARKER_OFFSETS_STORAGE_KEY = 'indonesia-city-demand-marker-offsets-v1'
    const SHIP_MARKER_POSITIONS_STORAGE_KEY = 'indonesia-sea-ship-marker-positions-v1'
    const SEA_SHIP_MARKER_POSITION_LOOKUP = SEA_SHIP_MARKER_POSITIONS
    const LAND_MARKER_POSITION_LOOKUP = LAND_MARKER_POSITIONS
    const DEED_IDS = Deeds.map((deed) => deed.id)
    const DEED_ID_SET = new Set(DEED_IDS)
    const LEGACY_DEED_POSITION_KEYS = new Set(
        Deeds.map((deed) => deedPositionKey(deed.region, deed.type))
    )
    const DEED_IDS_BY_LEGACY_POSITION_KEY = (() => {
        const byLegacyKey = new Map<string, string[]>()
        for (const deed of Deeds) {
            const legacyKey = deedPositionKey(deed.region, deed.type)
            const deedIds = byLegacyKey.get(legacyKey) ?? []
            deedIds.push(deed.id)
            byLegacyKey.set(legacyKey, deedIds)
        }
        return byLegacyKey
    })()
    const VALID_DEED_POSITION_KEYS = new Set([
        ...LEGACY_DEED_POSITION_KEYS,
        ...Deeds.map((deed) => deed.id)
    ])
    const PRODUCTION_ZONE_MARKER_OFFSETS_EVENT = 'indonesia-production-zone-marker-offsets-change'
    const DEBUG_COMPANY_MARKER_ENABLE_NS_DIRECTIONS = false
    const DEBUG_COMPANY_MARKER_BOARD_WIDTH = 2646
    const DEBUG_COMPANY_MARKER_BOARD_HEIGHT = 1280
    const DEBUG_COMPANY_MARKER_BASE_OFFSET_DISTANCE = 100
    const DEBUG_COMPANY_MARKER_RADIAL_STEP_DISTANCE = 18
    const DEBUG_COMPANY_MARKER_LATERAL_SPREAD_DISTANCE = 62
    const DEBUG_COMPANY_MARKER_EDGE_PADDING = 68
    const DEBUG_COMPANY_MARKER_COLOR_BY_GOOD: Record<ProductionMarkerType, string> = {
        rice: '#8eb15d',
        spice: '#b57949',
        rubber: '#6a4b3d',
        oil: '#5a6070',
        siapsaji: '#8f4ea4'
    }
    const SHIP_LAYOUT_OFFSETS: Record<1 | 2 | 3, Point[]> = {
        1: [{ x: 0, y: 0 }],
        2: [
            { x: -24, y: 0 },
            { x: 24, y: 0 }
        ],
        3: [
            { x: -26, y: 12 },
            { x: 0, y: -16 },
            { x: 26, y: 12 }
        ]
    }
    const DEBUG_RESEARCH_ROW_COUNT_BY_ROW: Readonly<Record<ResearchRow, number>> = {
        bid: 1,
        slots: 2,
        mergers: 3,
        expansion: 4,
        hull: 5
    }
    const DEBUG_RESEARCH_CUBE_SIZE = 18
    const DEBUG_RESEARCH_CUBE_GAP = 0.5
    const DEBUG_RESEARCH_CUBE_SPACING = DEBUG_RESEARCH_CUBE_SIZE + DEBUG_RESEARCH_CUBE_GAP
    const DEBUG_RESEARCH_SLOT_OUTLINE_COLOR = '#334155'
    const DEBUG_RESEARCH_SLOT_OUTLINE_WIDTH = 1.2
    const DEBUG_RESEARCH_SLOT_OUTLINE_OPACITY = 0.72
    const A10_MARKER_POSITION = LAND_MARKER_POSITION_LOOKUP['A10'] ?? { x: 390.8, y: 386.1 }
    const A26_MARKER_POSITION = LAND_MARKER_POSITION_LOOKUP['A26'] ?? { x: 595.9, y: 452.9 }
    const B02_MARKER_POSITION = LAND_MARKER_POSITION_LOOKUP['B02'] ?? { x: 946.9, y: 542.5 }
    const C09_MARKER_POSITION = LAND_MARKER_POSITION_LOOKUP['C09'] ?? { x: 916.9, y: 940.4 }
    const COMPANIES_SHIP_CARD_A10_X = A10_MARKER_POSITION.x + 50
    const COMPANIES_SHIP_CARD_A10_Y = A10_MARKER_POSITION.y - 210
    const COMPANIES_RUBBER_CARD_A26_X = A26_MARKER_POSITION.x + 120
    const COMPANIES_RUBBER_CARD_A26_Y = A26_MARKER_POSITION.y - 95
    const COMPANIES_RUBBER_CARD_B02_X = B02_MARKER_POSITION.x
    const COMPANIES_RUBBER_CARD_B02_Y = B02_MARKER_POSITION.y + 110
    const COMPANIES_SPICE_CARD_C09_X = C09_MARKER_POSITION.x + 10
    const COMPANIES_SPICE_CARD_C09_Y = C09_MARKER_POSITION.y + 160
    const PRODUCTION_MARKER_TYPES: ProductionMarkerType[] = [
        'spice',
        'siapsaji',
        'oil',
        'rice',
        'rubber'
    ]
    const CITY_DEMAND_TUNE_GOOD_ORDER = [
        Good.Rice,
        Good.Spice,
        Good.Rubber,
        Good.SiapSaji,
        Good.Oil
    ] as const
    const CITY_DEMAND_TUNE_TAG_DISTANCE = 62
    const CITY_DEMAND_TUNE_TAG_MAX_OFFSET = 14
    const CITY_DEMAND_TUNE_BOARD_CENTER = { x: 2646 / 2, y: 1280 / 2 }
    const GLASS_BEAD_PREVIEW_MARKERS = [
        { x: 172, y: 90, tone: 'amber' },
        { x: 207, y: 103, tone: 'red' },
        { x: 243, y: 92, tone: 'green' },
        { x: 279, y: 104, tone: 'amber' },
        { x: 314, y: 92, tone: 'red' },
        { x: 349, y: 103, tone: 'green' }
    ] as const

    function compareAreaIds(left: string, right: string): number {
        return left.localeCompare(right, undefined, { numeric: true })
    }

    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value))
    }

    function pairKey(a: string, b: string): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`
    }

    function hashStringToSeed(value: string): number {
        let hash = 0
        for (const char of value) {
            hash = (hash * 31 + char.charCodeAt(0)) >>> 0
        }
        return hash
    }

    function extractDirectionalNeighbors(neighbors: unknown, direction: 'Land' | 'Sea'): string[] {
        if (Array.isArray(neighbors)) {
            if (direction === 'Land') {
                return neighbors.filter(
                    (neighborId): neighborId is string => typeof neighborId === 'string'
                )
            }
            return []
        }

        if (neighbors && typeof neighbors === 'object') {
            const directionalNeighbors = (neighbors as Record<string, unknown>)[direction]
            if (Array.isArray(directionalNeighbors)) {
                return directionalNeighbors.filter(
                    (neighborId): neighborId is string => typeof neighborId === 'string'
                )
            }
        }

        return []
    }

    function extractLandNeighbors(neighbors: unknown): string[] {
        return extractDirectionalNeighbors(neighbors, 'Land')
    }

    function extractSeaNeighbors(neighbors: unknown): string[] {
        return extractDirectionalNeighbors(neighbors, 'Sea')
    }

    function extractNodeAreaType(nodeId: string, nodeType: unknown): BoardNodeAreaType {
        if (nodeType === 'Sea') {
            return 'Sea'
        }
        if (nodeType === 'Land') {
            return 'Land'
        }
        return nodeId.startsWith('S') ? 'Sea' : 'Land'
    }

    function getPaletteColor(index: number): string {
        if (index < DEBUG_PALETTE.length) {
            return DEBUG_PALETTE[index]
        }
        const hue = (index * 137.508) % 360
        return `hsl(${hue} 62% 54%)`
    }

    function markerGoodForGood(good: Good): ProductionMarkerType {
        if (good === Good.Rice) {
            return 'rice'
        }
        if (good === Good.Spice) {
            return 'spice'
        }
        if (good === Good.Rubber) {
            return 'rubber'
        }
        if (good === Good.Oil) {
            return 'oil'
        }
        return 'siapsaji'
    }

    function companyMarkerDirectionTowardTarget(
        markerX: number,
        markerY: number,
        targetX: number,
        targetY: number
    ): CompanyMarkerDirection {
        const deltaX = targetX - markerX
        const deltaY = targetY - markerY
        const cardinalDirection: CompanyMarkerDirection =
            Math.abs(deltaX) >= Math.abs(deltaY)
                ? deltaX >= 0
                    ? 'east'
                    : 'west'
                : deltaY >= 0
                  ? 'south'
                  : 'north'

        if (DEBUG_COMPANY_MARKER_ENABLE_NS_DIRECTIONS || cardinalDirection === 'east' || cardinalDirection === 'west') {
            return cardinalDirection
        }

        return deltaX >= 0 ? 'east' : 'west'
    }

    function setDeedCardPosition(positionKey: string, x: number, y: number): void {
        deedCardPositions = {
            ...deedCardPositions,
            [positionKey]: {
                x: roundToTenth(x),
                y: roundToTenth(y)
            }
        }
    }

    function parsePointOffsetMap(value: unknown): Record<string, Point> {
        if (!value || typeof value !== 'object') {
            return {}
        }

        const parsed = value as Record<string, unknown>
        const nextOffsets: Record<string, Point> = {}
        for (const [id, candidate] of Object.entries(parsed)) {
            if (!candidate || typeof candidate !== 'object') {
                continue
            }
            const point = candidate as { x?: unknown; y?: unknown }
            if (typeof point.x !== 'number' || typeof point.y !== 'number') {
                continue
            }
            nextOffsets[id] = {
                x: point.x,
                y: point.y
            }
        }

        return nextOffsets
    }

    function parseProductionZoneMarkerOffsets(value: unknown): Record<string, Point> {
        return parsePointOffsetMap(value)
    }

    function cloneShipLayout(layout: SeaShipLayout): SeaShipLayout {
        return {
            1: layout[1].map((point) => ({ ...point })),
            2: layout[2].map((point) => ({ ...point })),
            3: layout[3].map((point) => ({ ...point }))
        }
    }

    function getDefaultShipLayoutForArea(area: DebugArea): SeaShipLayout {
        const baseX = area.labelX
        const baseY = area.labelY
        const fallbackLayout: SeaShipLayout = {
            1: SHIP_LAYOUT_OFFSETS[1].map((offset) => ({
                x: baseX + offset.x,
                y: baseY + offset.y
            })),
            2: SHIP_LAYOUT_OFFSETS[2].map((offset) => ({
                x: baseX + offset.x,
                y: baseY + offset.y
            })),
            3: SHIP_LAYOUT_OFFSETS[3].map((offset) => ({
                x: baseX + offset.x,
                y: baseY + offset.y
            }))
        }

        const providedLayout = SEA_SHIP_MARKER_POSITION_LOOKUP[area.id]
        if (!providedLayout) {
            return fallbackLayout
        }

        return normalizeStoredShipLayout(providedLayout, fallbackLayout)
    }

    function normalizeStoredShipLayout(value: unknown, fallback: SeaShipLayout): SeaShipLayout {
        const normalized = cloneShipLayout(fallback)
        if (!value || typeof value !== 'object') {
            return normalized
        }

        for (const count of [1, 2, 3] as const) {
            const candidate = (value as Record<string, unknown>)[String(count)]
            if (!Array.isArray(candidate)) {
                continue
            }
            const fallbackPoints = fallback[count]
            const nextPoints = fallbackPoints.map((fallbackPoint, pointIndex) => {
                const source = candidate[pointIndex]
                if (!source || typeof source !== 'object') {
                    return { ...fallbackPoint }
                }
                const point = source as { x?: unknown; y?: unknown }
                if (typeof point.x !== 'number' || typeof point.y !== 'number') {
                    return { ...fallbackPoint }
                }
                return {
                    x: point.x,
                    y: point.y
                }
            })
            normalized[count] = nextPoints
        }

        return normalized
    }

    function getShipLayoutForSeaArea(seaArea: DebugArea): SeaShipLayout {
        const defaultLayout = getDefaultShipLayoutForArea(seaArea)
        const overrideLayout = shipMarkerPositions[seaArea.id]
        if (!overrideLayout) {
            return defaultLayout
        }
        return normalizeStoredShipLayout(overrideLayout, defaultLayout)
    }

    function getShipLayoutForSeaId(seaId: string): SeaShipLayout | null {
        const seaArea = SEA_DEBUG_AREAS_BY_ID.get(seaId)
        if (!seaArea) {
            return null
        }
        return getShipLayoutForSeaArea(seaArea)
    }

    function getSvgCoordinates(event: PointerEvent): Point | null {
        if (!debugSvgElement) {
            return null
        }
        const ctm = debugSvgElement.getScreenCTM()
        if (!ctm) {
            return null
        }
        const point = debugSvgElement.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        const transformed = point.matrixTransform(ctm.inverse())
        return {
            x: roundToTenth(transformed.x),
            y: roundToTenth(transformed.y)
        }
    }

    function setMarkerPositionForArea(areaId: string, x: number, y: number): void {
        markerPositions = {
            ...markerPositions,
            [areaId]: {
                x: roundToTenth(x),
                y: roundToTenth(y)
            }
        }
    }

    function setShipMarkerPosition(
        seaId: string,
        count: 1 | 2 | 3,
        markerIndex: number,
        x: number,
        y: number
    ): void {
        const currentLayout = getShipLayoutForSeaId(seaId)
        if (!currentLayout) {
            return
        }
        const nextLayout = cloneShipLayout(currentLayout)
        const points = nextLayout[count]
        if (markerIndex < 0 || markerIndex >= points.length) {
            return
        }
        points[markerIndex] = {
            x: roundToTenth(x),
            y: roundToTenth(y)
        }
        shipMarkerPositions = {
            ...shipMarkerPositions,
            [seaId]: nextLayout
        }
    }

    function getDefaultMarkerPositionForArea(area: DebugArea): Point {
        const defaultPosition = LAND_MARKER_POSITION_LOOKUP[area.id]
        if (defaultPosition) {
            return {
                x: defaultPosition.x,
                y: defaultPosition.y
            }
        }
        return {
            x: area.labelX,
            y: area.labelY
        }
    }

    function getMarkerPositionForArea(area: DebugArea): Point {
        const override = markerPositions[area.id]
        if (override) {
            return override
        }
        return getDefaultMarkerPositionForArea(area)
    }

    function startMarkerDrag(areaId: string, event: PointerEvent): void {
        if (colorMode !== 'marker') {
            return
        }
        markerSelectedAreaId = areaId
        markerDraggingAreaId = areaId
        const nextPoint = getSvgCoordinates(event)
        if (nextPoint) {
            setMarkerPositionForArea(areaId, nextPoint.x, nextPoint.y)
        }
        const target = event.currentTarget as Element | null
        target?.setPointerCapture?.(event.pointerId)
        event.preventDefault()
    }

    function startShipMarkerDrag(seaId: string, markerIndex: number, event: PointerEvent): void {
        if (colorMode !== 'ships') {
            return
        }
        shipMarkerSelectedSeaId = seaId
        shipMarkerSelectedIndex = markerIndex
        shipMarkerDragging = { seaId, index: markerIndex }
        const nextPoint = getSvgCoordinates(event)
        if (nextPoint) {
            setShipMarkerPosition(seaId, shipMarkerCount, markerIndex, nextPoint.x, nextPoint.y)
        }
        const target = event.currentTarget as Element | null
        target?.setPointerCapture?.(event.pointerId)
        event.preventDefault()
    }

    function startDeedCardDrag(positionKey: string, event: PointerEvent): void {
        if (colorMode !== 'deeds') {
            return
        }
        selectedDeedCardKey = positionKey
        deedCardDraggingKey = positionKey
        const nextPoint = getSvgCoordinates(event)
        if (nextPoint) {
            setDeedCardPosition(positionKey, nextPoint.x, nextPoint.y)
        }
        const target = event.currentTarget as Element | null
        target?.setPointerCapture?.(event.pointerId)
        event.preventDefault()
    }

    function setProductionZoneMarkerOffsetForAbsolutePosition(
        deedId: string,
        absolutePoint: Point
    ): void {
        const marker = DEBUG_PRODUCTION_DEED_MARKERS.find(
            (candidate) => candidate.deedId === deedId
        )
        if (!marker) {
            return
        }

        productionZoneMarkerOffsets = {
            ...productionZoneMarkerOffsets,
            [deedId]: {
                x: roundToTenth(absolutePoint.x - marker.baseX),
                y: roundToTenth(absolutePoint.y - marker.baseY)
            }
        }
    }

    function startProductionZoneMarkerDrag(deedId: string, event: PointerEvent): void {
        if (colorMode !== 'companymarkers') {
            return
        }

        selectedProductionZoneMarkerDeedId = deedId
        productionZoneMarkerDraggingDeedId = deedId
        const nextPoint = getSvgCoordinates(event)
        if (nextPoint) {
            setProductionZoneMarkerOffsetForAbsolutePosition(deedId, nextPoint)
        }
        const target = event.currentTarget as Element | null
        target?.setPointerCapture?.(event.pointerId)
        event.preventDefault()
    }

    function setCityDemandMarkerOffsetForAbsolutePosition(
        regionId: string,
        absolutePoint: Point
    ): void {
        const marker = CITY_DEMAND_TUNE_BASE_MARKERS.find(
            (candidate) => candidate.regionId === regionId
        )
        if (!marker) {
            return
        }

        cityDemandMarkerOffsets = {
            ...cityDemandMarkerOffsets,
            [regionId]: {
                x: roundToTenth(absolutePoint.x - marker.x),
                y: roundToTenth(absolutePoint.y - marker.y)
            }
        }
    }

    function startCityDemandMarkerDrag(regionId: string, event: PointerEvent): void {
        if (colorMode !== 'citydemand') {
            return
        }

        cityDemandSelectedRegionId = regionId
        cityDemandDraggingRegionId = regionId
        const nextPoint = getSvgCoordinates(event)
        if (nextPoint) {
            setCityDemandMarkerOffsetForAbsolutePosition(regionId, nextPoint)
        }
        const target = event.currentTarget as Element | null
        target?.setPointerCapture?.(event.pointerId)
        event.preventDefault()
    }

    function stopMarkerDrag(): void {
        markerDraggingAreaId = null
        shipMarkerDragging = null
        deedCardDraggingKey = null
        productionZoneMarkerDraggingDeedId = null
        cityDemandDraggingRegionId = null
    }

    function handleMarkerPointerMove(event: PointerEvent): void {
        if (colorMode === 'marker' && markerDraggingAreaId) {
            const nextPoint = getSvgCoordinates(event)
            if (!nextPoint) {
                return
            }
            setMarkerPositionForArea(markerDraggingAreaId, nextPoint.x, nextPoint.y)
            return
        }

        if (colorMode === 'deeds' && deedCardDraggingKey) {
            const nextPoint = getSvgCoordinates(event)
            if (!nextPoint) {
                return
            }
            setDeedCardPosition(deedCardDraggingKey, nextPoint.x, nextPoint.y)
            return
        }

        if (colorMode !== 'ships' || !shipMarkerDragging) {
            if (colorMode === 'companymarkers' && productionZoneMarkerDraggingDeedId) {
                const nextPoint = getSvgCoordinates(event)
                if (!nextPoint) {
                    return
                }
                setProductionZoneMarkerOffsetForAbsolutePosition(
                    productionZoneMarkerDraggingDeedId,
                    nextPoint
                )
                return
            }
            if (colorMode === 'citydemand' && cityDemandDraggingRegionId) {
                const nextPoint = getSvgCoordinates(event)
                if (!nextPoint) {
                    return
                }
                setCityDemandMarkerOffsetForAbsolutePosition(cityDemandDraggingRegionId, nextPoint)
            }
            return
        }
        const nextPoint = getSvgCoordinates(event)
        if (!nextPoint) {
            return
        }
        setShipMarkerPosition(
            shipMarkerDragging.seaId,
            shipMarkerCount,
            shipMarkerDragging.index,
            nextPoint.x,
            nextPoint.y
        )
    }

    function clearSelectedMarkerOverride(): void {
        if (!markerSelectedAreaId || markerPositions[markerSelectedAreaId] === undefined) {
            return
        }
        const nextPositions = { ...markerPositions }
        delete nextPositions[markerSelectedAreaId]
        markerPositions = nextPositions
    }

    function clearAllMarkerOverrides(): void {
        markerPositions = {}
    }

    function clearSelectedShipMarkerOverride(): void {
        if (
            !shipMarkerSelectedSeaId ||
            shipMarkerPositions[shipMarkerSelectedSeaId] === undefined
        ) {
            return
        }
        const nextPositions = { ...shipMarkerPositions }
        delete nextPositions[shipMarkerSelectedSeaId]
        shipMarkerPositions = nextPositions
    }

    function clearAllShipMarkerOverrides(): void {
        shipMarkerPositions = {}
    }

    function clearSelectedDeedCardOverride(): void {
        if (!selectedDeedCardKey || deedCardPositions[selectedDeedCardKey] === undefined) {
            return
        }
        const nextPositions = { ...deedCardPositions }
        delete nextPositions[selectedDeedCardKey]
        deedCardPositions = nextPositions
    }

    function clearAllDeedCardOverrides(): void {
        deedCardPositions = {}
    }

    function clearSelectedProductionZoneMarkerOverride(): void {
        if (
            !selectedProductionZoneMarkerDeedId ||
            productionZoneMarkerOffsets[selectedProductionZoneMarkerDeedId] === undefined
        ) {
            return
        }

        const nextOffsets = { ...productionZoneMarkerOffsets }
        delete nextOffsets[selectedProductionZoneMarkerDeedId]
        productionZoneMarkerOffsets = nextOffsets
    }

    function clearAllProductionZoneMarkerOverrides(): void {
        productionZoneMarkerOffsets = {}
    }

    function clearSelectedCityDemandMarkerOverride(): void {
        if (
            !cityDemandSelectedRegionId ||
            cityDemandMarkerOffsets[cityDemandSelectedRegionId] === undefined
        ) {
            return
        }

        const nextOffsets = { ...cityDemandMarkerOffsets }
        delete nextOffsets[cityDemandSelectedRegionId]
        cityDemandMarkerOffsets = nextOffsets
    }

    function clearAllCityDemandMarkerOverrides(): void {
        cityDemandMarkerOffsets = {}
    }

    function selectShipMarkerCount(nextCount: 1 | 2 | 3): void {
        shipMarkerCount = nextCount
        const maxMarkerIndex = nextCount - 1
        if (shipMarkerSelectedIndex > maxMarkerIndex) {
            shipMarkerSelectedIndex = maxMarkerIndex
        }
    }

    function getLayoutShipCountForSeaId(seaId: string): 1 | 2 | 3 {
        return layoutShipCountBySeaId[seaId] ?? 1
    }

    function setLayoutShipCountForSeaId(seaId: string, shipCount: 1 | 2 | 3): void {
        layoutShipCountBySeaId = {
            ...layoutShipCountBySeaId,
            [seaId]: shipCount
        }
    }

    function setLayoutShipCountForAll(shipCount: 1 | 2 | 3): void {
        const nextShipCountBySeaId: Record<string, 1 | 2 | 3> = {}
        for (const seaArea of SEA_DEBUG_MAP_AREAS) {
            nextShipCountBySeaId[seaArea.id] = shipCount
        }
        layoutShipCountBySeaId = nextShipCountBySeaId
    }

    function selectCompanyShipMarkerCount(nextCount: 1 | 2 | 3): void {
        companyShipMarkerCount = nextCount
    }

    async function copyToClipboard(
        value: string,
        target: 'marker' | 'ship' | 'deed' | 'companymarker' | 'citydemand' = 'marker'
    ): Promise<void> {
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
            if (target === 'ship') {
                shipMarkerCopyStatus = 'Clipboard unavailable'
            } else if (target === 'deed') {
                deedCardCopyStatus = 'Clipboard unavailable'
            } else if (target === 'companymarker') {
                productionZoneMarkerCopyStatus = 'Clipboard unavailable'
            } else if (target === 'citydemand') {
                cityDemandCopyStatus = 'Clipboard unavailable'
            } else {
                markerCopyStatus = 'Clipboard unavailable'
            }
            return
        }
        try {
            await navigator.clipboard.writeText(value)
            if (target === 'ship') {
                shipMarkerCopyStatus = 'Copied'
            } else if (target === 'deed') {
                deedCardCopyStatus = 'Copied'
            } else if (target === 'companymarker') {
                productionZoneMarkerCopyStatus = 'Copied'
            } else if (target === 'citydemand') {
                cityDemandCopyStatus = 'Copied'
            } else {
                markerCopyStatus = 'Copied'
            }
        } catch {
            if (target === 'ship') {
                shipMarkerCopyStatus = 'Copy failed'
            } else if (target === 'deed') {
                deedCardCopyStatus = 'Copy failed'
            } else if (target === 'companymarker') {
                productionZoneMarkerCopyStatus = 'Copy failed'
            } else if (target === 'citydemand') {
                cityDemandCopyStatus = 'Copy failed'
            } else {
                markerCopyStatus = 'Copy failed'
            }
        }
    }

    onMount(() => {
        if (typeof window === 'undefined') {
            return
        }
        try {
            const stored = window.localStorage.getItem(MARKER_POSITIONS_STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, unknown>
                const nextPositions: Record<string, Point> = {}
                for (const [areaId, value] of Object.entries(parsed)) {
                    if (!value || typeof value !== 'object') {
                        continue
                    }
                    const candidate = value as { x?: unknown; y?: unknown }
                    if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') {
                        continue
                    }
                    nextPositions[areaId] = {
                        x: candidate.x,
                        y: candidate.y
                    }
                }
                markerPositions = nextPositions
            }
        } catch {
            markerPositions = {}
        } finally {
            markerPositionsLoaded = true
        }

        try {
            const stored = window.localStorage.getItem(CITY_DEMAND_MARKER_OFFSETS_STORAGE_KEY)
            if (stored) {
                cityDemandMarkerOffsets = parsePointOffsetMap(JSON.parse(stored))
            }
        } catch {
            cityDemandMarkerOffsets = {}
        } finally {
            cityDemandMarkerOffsetsLoaded = true
        }

        try {
            const stored = window.localStorage.getItem(SHIP_MARKER_POSITIONS_STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, unknown>
                const nextPositions: Record<string, SeaShipLayout> = {}
                for (const seaArea of SEA_DEBUG_MAP_AREAS) {
                    const fallback = getDefaultShipLayoutForArea(seaArea)
                    const storedLayout = parsed[seaArea.id]
                    const normalized = normalizeStoredShipLayout(storedLayout, fallback)
                    if (storedLayout !== undefined) {
                        nextPositions[seaArea.id] = normalized
                    }
                }
                shipMarkerPositions = nextPositions
            }
        } catch {
            shipMarkerPositions = {}
        } finally {
            shipMarkerPositionsLoaded = true
        }

        try {
            const stored = window.localStorage.getItem(DEED_CARD_POSITIONS_STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, unknown>
                const nextPositions: Record<string, Point> = {}
                for (const [positionKey, value] of Object.entries(parsed)) {
                    if (!value || typeof value !== 'object') {
                        continue
                    }
                    const candidate = value as { x?: unknown; y?: unknown }
                    if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') {
                        continue
                    }
                    if (!VALID_DEED_POSITION_KEYS.has(positionKey)) {
                        continue
                    }
                    nextPositions[positionKey] = {
                        x: candidate.x,
                        y: candidate.y
                    }
                }
                deedCardPositions = nextPositions
            }
        } catch {
            deedCardPositions = {}
        } finally {
            deedCardPositionsLoaded = true
        }

        try {
            const stored = window.localStorage.getItem(PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY)
            if (stored) {
                productionZoneMarkerOffsets = parseProductionZoneMarkerOffsets(JSON.parse(stored))
            }
        } catch {
            productionZoneMarkerOffsets = {}
        } finally {
            productionZoneMarkerOffsetsLoaded = true
        }
    })

    $effect(() => {
        if (!markerPositionsLoaded || typeof window === 'undefined') {
            return
        }
        window.localStorage.setItem(MARKER_POSITIONS_STORAGE_KEY, JSON.stringify(markerPositions))
    })

    $effect(() => {
        if (!cityDemandMarkerOffsetsLoaded || typeof window === 'undefined') {
            return
        }
        window.localStorage.setItem(
            CITY_DEMAND_MARKER_OFFSETS_STORAGE_KEY,
            JSON.stringify(cityDemandMarkerOffsets)
        )
    })

    $effect(() => {
        if (!shipMarkerPositionsLoaded || typeof window === 'undefined') {
            return
        }
        window.localStorage.setItem(
            SHIP_MARKER_POSITIONS_STORAGE_KEY,
            JSON.stringify(shipMarkerPositions)
        )
    })

    $effect(() => {
        if (!deedCardPositionsLoaded || typeof window === 'undefined') {
            return
        }
        window.localStorage.setItem(
            DEED_CARD_POSITIONS_STORAGE_KEY,
            JSON.stringify(deedCardPositions)
        )
    })

    $effect(() => {
        if (!productionZoneMarkerOffsetsLoaded || typeof window === 'undefined') {
            return
        }
        window.localStorage.setItem(
            PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY,
            JSON.stringify(productionZoneMarkerOffsets)
        )
        window.dispatchEvent(new Event(PRODUCTION_ZONE_MARKER_OFFSETS_EVENT))
    })

    const BOARD_GEOMETRY_AREAS = [
        ...LEFTMOST_ISLAND_AREAS,
        ...SOUTHLEFT_ISLAND_AREAS,
        ...TOP_CENTER_ISLAND_AREAS,
        ...EASTCENTRAL_ISLAND_AREAS,
        ...SOUTHCHAIN_ISLAND_AREAS,
        ...NORTHEAST_ISLAND_AREAS,
        ...EAST_ISLAND_AREAS
    ]
    const BOARD_GEOMETRY_LOOKUP = new Map(BOARD_GEOMETRY_AREAS.map((area) => [area.id, area.path]))

    const BOARD_NODES: BoardNodeView[] = $derived.by(() => {
        const nodes = Array.from(gameSession.gameState.board, (node) => ({
            id: node.id,
            type: extractNodeAreaType(
                node.id,
                (
                    node as {
                        type?: unknown
                    }
                ).type
            ),
            landNeighbors: extractLandNeighbors(node.neighbors),
            seaNeighbors: extractSeaNeighbors(node.neighbors),
            region: node.region
        }))
        nodes.sort((left, right) => compareAreaIds(left.id, right.id))
        return nodes
    })

    const LAND_DEBUG_MAP_AREAS: DebugArea[] = $derived.by(() => {
        const mappedAreas: DebugArea[] = []
        const seenIds = new Set<string>()

        for (const node of BOARD_NODES) {
            if (seenIds.has(node.id)) {
                continue
            }
            seenIds.add(node.id)

            const path = BOARD_GEOMETRY_LOOKUP.get(node.id)
            if (!path) {
                continue
            }
            const labelPosition = getPathCenter(path)

            mappedAreas.push({
                id: node.id,
                path,
                label: node.id,
                region: node.region,
                labelX: labelPosition.x,
                labelY: labelPosition.y
            })
        }

        return mappedAreas
    })

    const SEA_DEBUG_MAP_AREAS: DebugArea[] = $derived.by(() => {
        const areas = SEA_AREAS.map((area) => {
            const labelPosition = getPathCenter(area.path)
            return {
                id: area.id,
                path: area.path,
                label: area.id,
                region: null,
                labelX: labelPosition.x,
                labelY: labelPosition.y
            }
        })
        areas.sort((left, right) => compareAreaIds(left.id, right.id))
        return areas
    })

    const SEA_DEBUG_AREAS_BY_ID: Map<string, DebugArea> = $derived.by(
        () => new Map(SEA_DEBUG_MAP_AREAS.map((area) => [area.id, area]))
    )

    const COASTAL_LAND_AREA_IDS: Set<string> = $derived.by(() => {
        const coastalAreaIds = new Set<string>()
        for (const node of BOARD_NODES) {
            if (node.type !== 'Sea') {
                continue
            }
            for (const landNeighborId of node.landNeighbors) {
                coastalAreaIds.add(landNeighborId)
            }
        }
        return coastalAreaIds
    })

    const COASTAL_LAND_DEBUG_AREAS: DebugArea[] = $derived.by(() =>
        LAND_DEBUG_MAP_AREAS.filter((area) => COASTAL_LAND_AREA_IDS.has(area.id))
    )

    const RESEARCH_TRACK_CELLS_BY_ROW: Record<ResearchRow, (typeof RESEARCH_TRACK_CELLS)[number][]> =
        {
            bid: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'bid'),
            slots: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'slots'),
            mergers: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'mergers'),
            expansion: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'expansion'),
            hull: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'hull')
        }

    const DEBUG_RESEARCH_PLAYER_COLORS: string[] = $derived.by(() => {
        const playerIds = gameSession.gameState.turnManager.turnOrder
        if (playerIds.length > 0) {
            return playerIds.map((playerId) => gameSession.colors.getPlayerUiColor(playerId))
        }

        return gameSession.gameState.players.map((playerState) =>
            gameSession.colors.getPlayerUiColor(playerState.playerId)
        )
    })

    const DEBUG_RESEARCH_CUBES: DebugResearchCube[] = $derived.by(() => {
        if (colorMode !== 'research') {
            return []
        }

        const cubes: DebugResearchCube[] = []
        for (const row of RESEARCH_ROWS) {
            const rowCells = RESEARCH_TRACK_CELLS_BY_ROW[row]
            const cubeCount = DEBUG_RESEARCH_ROW_COUNT_BY_ROW[row]

            for (let columnIndex = 0; columnIndex < rowCells.length; columnIndex += 1) {
                const cell = rowCells[columnIndex]
                if (!cell) {
                    continue
                }

                const offsets = researchCubeOffsets(
                    cubeCount,
                    DEBUG_RESEARCH_CUBE_SPACING,
                    row,
                    `${row}-${columnIndex}`
                )
                for (let cubeIndex = 0; cubeIndex < cubeCount; cubeIndex += 1) {
                    const offset = offsets[cubeIndex]
                    if (!offset) {
                        continue
                    }

                    cubes.push({
                        key: `${row}-${columnIndex}-${cubeIndex}`,
                        x:
                            cell.center.x +
                            offset.x +
                            researchCubeHorizontalJitter(
                                `${columnIndex}-${cubeIndex}`,
                                row,
                                DEBUG_RESEARCH_CUBE_SPACING
                            ),
                        y: cell.center.y + offset.y,
                        color:
                            DEBUG_RESEARCH_PLAYER_COLORS[
                                cubeIndex % DEBUG_RESEARCH_PLAYER_COLORS.length
                            ] ?? '#64748b',
                        rotationDegrees: researchCubeRotationDegrees(
                            `${columnIndex}-${cubeIndex}`,
                            row
                        )
                    })
                }
            }
        }

        return cubes
    })

    const DISPLAY_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode === 'none') {
            return []
        }
        if (colorMode === 'sea') {
            return SEA_DEBUG_MAP_AREAS
        }
        if (colorMode === 'ships') {
            return SEA_DEBUG_MAP_AREAS
        }
        if (colorMode === 'coastal') {
            return COASTAL_LAND_DEBUG_AREAS
        }
        if (colorMode === 'production') {
            return []
        }
        if (colorMode === 'companies') {
            return []
        }
        if (colorMode === 'deeds') {
            return []
        }
        if (colorMode === 'research') {
            return []
        }
        if (colorMode === 'companymarkers') {
            return []
        }
        if (colorMode === 'citydemand') {
            return []
        }
        if (colorMode === 'layout') {
            return []
        }
        if (colorMode === 'marker') {
            return LAND_DEBUG_MAP_AREAS
        }
        return LAND_DEBUG_MAP_AREAS
    })

    const LAND_DEBUG_AREAS_BY_ID: Map<string, DebugArea> = $derived.by(
        () => new Map(LAND_DEBUG_MAP_AREAS.map((area) => [area.id, area]))
    )

    const REGION_CENTER_BY_ID: Map<string, Point> = $derived.by(() => {
        const areasByRegion = new Map<string, DebugArea[]>()
        for (const area of LAND_DEBUG_MAP_AREAS) {
            if (!area.region) {
                continue
            }
            const areas = areasByRegion.get(area.region) ?? []
            areas.push(area)
            areasByRegion.set(area.region, areas)
        }

        const centers = new Map<string, Point>()
        for (const [regionId, areas] of areasByRegion.entries()) {
            if (areas.length === 0) {
                continue
            }
            const sums = areas.reduce(
                (accumulator, area) => {
                    const position = getDefaultMarkerPositionForArea(area)
                    accumulator.x += position.x
                    accumulator.y += position.y
                    return accumulator
                },
                { x: 0, y: 0 }
            )
            centers.set(regionId, {
                x: sums.x / areas.length,
                y: sums.y / areas.length
            })
        }

        return centers
    })

    const DEBUG_PRODUCTION_DEED_MARKERS: DebugProductionDeedMarkerEntry[] = $derived.by(() => {
        gameSession.gameState.actionCount
        productionZoneMarkerOffsets

        const deedOffsetsById: Record<string, Point> = {
            ...PRODUCTION_ZONE_MARKER_OFFSETS,
            ...productionZoneMarkerOffsets
        }
        const boardCenter = {
            x: DEBUG_COMPANY_MARKER_BOARD_WIDTH / 2,
            y: DEBUG_COMPANY_MARKER_BOARD_HEIGHT / 2
        }
        const productionDeeds = Deeds.filter(
            (deed): deed is Extract<AnyDeed, { type: CompanyType.Production }> =>
                deed.type === CompanyType.Production
        )
            .slice()
            .sort((left, right) => {
                if (left.region !== right.region) {
                    return left.region.localeCompare(right.region, undefined, { numeric: true })
                }
                return left.id.localeCompare(right.id, undefined, { numeric: true })
            })

        const deedsByRegion = new Map<string, typeof productionDeeds>()
        for (const deed of productionDeeds) {
            const deeds = deedsByRegion.get(deed.region) ?? []
            deeds.push(deed)
            deedsByRegion.set(deed.region, deeds)
        }

        const markers: DebugProductionDeedMarkerEntry[] = []
        for (const [regionId, regionDeeds] of deedsByRegion.entries()) {
            const target = REGION_CENTER_BY_ID.get(regionId)
            if (!target) {
                continue
            }

            for (const [deedIndex, deed] of regionDeeds.entries()) {
                const centeredIndex = deedIndex - (regionDeeds.length - 1) / 2
                let directionX = target.x - boardCenter.x
                let directionY = target.y - boardCenter.y
                const magnitude = Math.hypot(directionX, directionY)
                if (magnitude > 0.001) {
                    directionX /= magnitude
                    directionY /= magnitude
                } else {
                    directionX = 0
                    directionY = -1
                }
                const tangentX = -directionY
                const tangentY = directionX
                const radialDistance =
                    DEBUG_COMPANY_MARKER_BASE_OFFSET_DISTANCE +
                    Math.floor(Math.abs(centeredIndex)) * DEBUG_COMPANY_MARKER_RADIAL_STEP_DISTANCE
                const lateralDistance = centeredIndex * DEBUG_COMPANY_MARKER_LATERAL_SPREAD_DISTANCE
                const baseX = clamp(
                    target.x + directionX * radialDistance + tangentX * lateralDistance,
                    DEBUG_COMPANY_MARKER_EDGE_PADDING,
                    DEBUG_COMPANY_MARKER_BOARD_WIDTH - DEBUG_COMPANY_MARKER_EDGE_PADDING
                )
                const baseY = clamp(
                    target.y + directionY * radialDistance + tangentY * lateralDistance,
                    DEBUG_COMPANY_MARKER_EDGE_PADDING,
                    DEBUG_COMPANY_MARKER_BOARD_HEIGHT - DEBUG_COMPANY_MARKER_EDGE_PADDING
                )
                const offset = deedOffsetsById[deed.id] ?? { x: 0, y: 0 }
                const x = clamp(
                    baseX + offset.x,
                    DEBUG_COMPANY_MARKER_EDGE_PADDING,
                    DEBUG_COMPANY_MARKER_BOARD_WIDTH - DEBUG_COMPANY_MARKER_EDGE_PADDING
                )
                const y = clamp(
                    baseY + offset.y,
                    DEBUG_COMPANY_MARKER_EDGE_PADDING,
                    DEBUG_COMPANY_MARKER_BOARD_HEIGHT - DEBUG_COMPANY_MARKER_EDGE_PADDING
                )
                const markerGood = markerGoodForGood(deed.good)

                markers.push({
                    key: `${regionId}|${deed.id}`,
                    deedId: deed.id,
                    regionId,
                    x,
                    y,
                    baseX,
                    baseY,
                    targetX: target.x,
                    targetY: target.y,
                    ownerColor: DEBUG_COMPANY_MARKER_COLOR_BY_GOOD[markerGood],
                    goodType: markerGood,
                    goodsCount: 1,
                    hatchPatternId: null,
                    direction: companyMarkerDirectionTowardTarget(x, y, target.x, target.y)
                })
            }
        }

        return markers.sort((left, right) => left.key.localeCompare(right.key))
    })

    const SELECTED_PRODUCTION_ZONE_MARKER_ENTRY: DebugProductionDeedMarkerEntry | null = $derived.by(() => {
        if (!selectedProductionZoneMarkerDeedId) {
            return null
        }
        return (
            DEBUG_PRODUCTION_DEED_MARKERS.find(
                (entry) => entry.deedId === selectedProductionZoneMarkerDeedId
            ) ?? null
        )
    })

    function getDeedCardPosition(positionKey: string): Point | null {
        return getDeedCardPositionByKeys([positionKey])
    }

    function getDeedCardPositionByKeys(positionKeys: readonly string[]): Point | null {
        for (const positionKey of positionKeys) {
            const overridePosition = deedCardPositions[positionKey]
            if (overridePosition) {
                return {
                    x: overridePosition.x,
                    y: overridePosition.y
                }
            }

            const baselinePosition = DEED_CARD_POSITIONS[positionKey]
            if (baselinePosition) {
                return {
                    x: baselinePosition.x,
                    y: baselinePosition.y
                }
            }
        }

        return null
    }

    function selectDeedEra(nextEra: Era): void {
        deedEra = nextEra
        selectedDeedCardKey = null
        deedCardDraggingKey = null
    }

    const DEEDS_FOR_SELECTED_ERA: AnyDeed[] = $derived.by(() =>
        Deeds.filter((deed) => deed.era === deedEra)
    )

    const DEED_TUNE_ENTRIES: DeedTuneEntry[] = $derived.by(() => {
        const entries: DeedTuneEntry[] = []
        for (const deed of DEEDS_FOR_SELECTED_ERA) {
            const positionKey = deedPositionRenderKey(deed)
            const legacyPositionKey = deedPositionKey(deed.region, deed.type)
            const position = getDeedCardPositionByKeys(deedPositionLookupKeys(deed))
            if (!position) {
                continue
            }
            entries.push({
                deedId: deed.id,
                deedType: deed.type,
                positionKey,
                legacyPositionKey,
                regionId: deed.region,
                regionName: getRegionName(deed.region),
                cardKind: deedCardKindFor(deed),
                shippingSizes: shippingSizeEntriesFromDeed(deed),
                x: position.x,
                y: position.y
            })
        }
        return entries.sort((left, right) =>
            left.positionKey.localeCompare(right.positionKey, undefined, { numeric: true })
        )
    })

    const ALL_DEED_TUNE_ENTRIES: DeedTuneEntry[] = $derived.by(() => {
        const entries: DeedTuneEntry[] = []
        for (const deed of Deeds) {
            const positionKey = deedPositionRenderKey(deed)
            const legacyPositionKey = deedPositionKey(deed.region, deed.type)
            const position = getDeedCardPositionByKeys(deedPositionLookupKeys(deed))
            if (!position) {
                continue
            }
            entries.push({
                deedId: deed.id,
                deedType: deed.type,
                positionKey,
                legacyPositionKey,
                regionId: deed.region,
                regionName: getRegionName(deed.region),
                cardKind: deedCardKindFor(deed),
                shippingSizes: shippingSizeEntriesFromDeed(deed),
                x: position.x,
                y: position.y
            })
        }

        return entries.sort((left, right) =>
            left.positionKey.localeCompare(right.positionKey, undefined, { numeric: true })
        )
    })

    const DEED_TUNE_ENTRY_BY_POSITION_KEY: Map<string, DeedTuneEntry> = $derived.by(() => {
        const byKey = new Map<string, DeedTuneEntry>()
        for (const entry of DEED_TUNE_ENTRIES) {
            if (!byKey.has(entry.positionKey)) {
                byKey.set(entry.positionKey, entry)
            }
        }
        return byKey
    })

    const SELECTED_DEED_TUNE_ENTRY: DeedTuneEntry | null = $derived.by(() => {
        if (!selectedDeedCardKey) {
            return null
        }
        return DEED_TUNE_ENTRY_BY_POSITION_KEY.get(selectedDeedCardKey) ?? null
    })

    function deedCardOverridesByDeedId(): Map<string, Point> {
        const byDeedId = new Map<string, Point>()

        for (const [key, point] of Object.entries(deedCardPositions)) {
            if (DEED_ID_SET.has(key)) {
                byDeedId.set(key, point)
            }
        }

        for (const [key, point] of Object.entries(deedCardPositions)) {
            if (!LEGACY_DEED_POSITION_KEYS.has(key)) {
                continue
            }
            const deedIds = DEED_IDS_BY_LEGACY_POSITION_KEY.get(key) ?? []
            for (const deedId of deedIds) {
                if (!byDeedId.has(deedId)) {
                    byDeedId.set(deedId, point)
                }
            }
        }

        return byDeedId
    }

    const DEED_CARD_OVERRIDES_EXPORT_TEXT: string = $derived.by(() => {
        const deedOverrides = deedCardOverridesByDeedId()
        if (deedOverrides.size === 0) {
            return '// No deed card overrides yet.'
        }
        const deedIds = [...deedOverrides.keys()].sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
        )
        const lines = deedIds
            .map((deedId) => {
                const point = deedOverrides.get(deedId)
                if (!point) {
                    return ''
                }
                return `    '${deedId}': { x: ${point.x.toFixed(1)}, y: ${point.y.toFixed(1)} },`
            })
            .filter((line): line is string => line.length > 0)
        return `export const DEED_CARD_POSITIONS = {\n${lines.join('\n')}\n} as const`
    })

    const DEED_CARD_FULL_EXPORT_TEXT: string = $derived.by(() => {
        const lineByDeedId = new Map(
            ALL_DEED_TUNE_ENTRIES.map((entry) => [
                entry.deedId,
                `    '${entry.deedId}': { x: ${entry.x.toFixed(1)}, y: ${entry.y.toFixed(1)} },`
            ])
        )
        const lines = DEED_IDS.map((deedId) => lineByDeedId.get(deedId)).filter(
            (line): line is string => !!line
        )
        return `export const DEED_CARD_POSITIONS = {\n${lines.join('\n')}\n} as const`
    })

    const PRODUCTION_ZONE_MARKER_OVERRIDES_EXPORT_TEXT: string = $derived.by(() => {
        const deedIds = Object.keys(productionZoneMarkerOffsets).sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
        )
        if (deedIds.length === 0) {
            return '// No production zone marker overrides yet.'
        }
        const markerByDeedId = new Map(
            DEBUG_PRODUCTION_DEED_MARKERS.map((marker) => [marker.deedId, marker] as const)
        )
        const lines = deedIds.map((deedId) => {
            const offset = productionZoneMarkerOffsets[deedId]
            const marker = markerByDeedId.get(deedId)
            const suffix = marker ? ` // ${marker.regionId}` : ''
            return `    '${deedId}': { x: ${offset.x.toFixed(1)}, y: ${offset.y.toFixed(1)} },${suffix}`
        })
        return `export const PRODUCTION_ZONE_MARKER_OFFSETS = {\n${lines.join('\n')}\n} as const`
    })

    const PRODUCTION_ZONE_MARKER_FULL_EXPORT_TEXT: string = $derived.by(() => {
        const mergedOffsets: Record<string, Point> = {
            ...PRODUCTION_ZONE_MARKER_OFFSETS,
            ...productionZoneMarkerOffsets
        }
        const deedIds = Object.keys(mergedOffsets).sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
        )
        const lines = deedIds.map((deedId) => {
            const offset = mergedOffsets[deedId]
            return `    '${deedId}': { x: ${offset.x.toFixed(1)}, y: ${offset.y.toFixed(1)} },`
        })
        return `export const PRODUCTION_ZONE_MARKER_OFFSETS = {\n${lines.join('\n')}\n} as const`
    })

    const BOARD_NODES_BY_ID: Map<string, BoardNodeView> = $derived.by(
        () => new Map(BOARD_NODES.map((node) => [node.id, node]))
    )

    const BOARD_ADJACENCY: Map<string, Set<string>> = $derived.by(() => {
        const adjacency = new Map<string, Set<string>>()
        for (const node of BOARD_NODES) {
            const neighbors = adjacency.get(node.id) ?? new Set<string>()
            for (const neighborId of node.landNeighbors) {
                neighbors.add(neighborId)
                const reverseNeighbors = adjacency.get(neighborId) ?? new Set<string>()
                reverseNeighbors.add(node.id)
                adjacency.set(neighborId, reverseNeighbors)
            }
            adjacency.set(node.id, neighbors)
        }
        return adjacency
    })

    const DEBUG_CONNECTIONS: DebugConnection[] = $derived.by(() => {
        if (colorMode !== 'land') {
            return []
        }

        const connections: DebugConnection[] = []
        const seenEdgeIds = new Set<string>()

        for (const node of BOARD_NODES) {
            for (const neighborId of node.landNeighbors) {
                const edgeId = pairKey(node.id, neighborId)
                if (seenEdgeIds.has(edgeId)) {
                    continue
                }
                seenEdgeIds.add(edgeId)

                const from = LAND_DEBUG_AREAS_BY_ID.get(node.id)
                const to = LAND_DEBUG_AREAS_BY_ID.get(neighborId)
                if (!from || !to) {
                    continue
                }

                connections.push({
                    id: edgeId,
                    x1: from.labelX,
                    y1: from.labelY,
                    x2: to.labelX,
                    y2: to.labelY
                })
            }
        }

        connections.sort((left, right) => left.id.localeCompare(right.id))
        return connections
    })

    const HOVERED_SEA_LAND_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode !== 'sea' || !hoveredSeaId) {
            return []
        }

        const seaNode = BOARD_NODES_BY_ID.get(hoveredSeaId)
        if (!seaNode || seaNode.type !== 'Sea') {
            return []
        }

        return seaNode.landNeighbors
            .map((neighborId) => LAND_DEBUG_AREAS_BY_ID.get(neighborId))
            .filter((area): area is DebugArea => area !== undefined)
            .sort((left, right) => compareAreaIds(left.id, right.id))
    })

    const COMPANY_R01_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode !== 'companies') {
            return []
        }
        return LAND_DEBUG_MAP_AREAS.filter((area) => area.region === 'R01').sort((left, right) =>
            compareAreaIds(left.id, right.id)
        )
    })

    const COMPANY_R03_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode !== 'companies') {
            return []
        }
        return LAND_DEBUG_MAP_AREAS.filter((area) => area.region === 'R03').sort((left, right) =>
            compareAreaIds(left.id, right.id)
        )
    })

    const COMPANY_R04_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode !== 'companies') {
            return []
        }
        return LAND_DEBUG_MAP_AREAS.filter((area) => area.region === 'R04').sort((left, right) =>
            compareAreaIds(left.id, right.id)
        )
    })

    const COMPANY_R10_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode !== 'companies') {
            return []
        }
        return LAND_DEBUG_MAP_AREAS.filter((area) => area.region === 'R10').sort((left, right) =>
            compareAreaIds(left.id, right.id)
        )
    })

    const COMPANY_R19_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode !== 'companies') {
            return []
        }
        return LAND_DEBUG_MAP_AREAS.filter((area) => area.region === 'R19').sort((left, right) =>
            compareAreaIds(left.id, right.id)
        )
    })

    const COMPANY_SHIP_SEA_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode !== 'companies') {
            return []
        }
        return SEA_DEBUG_MAP_AREAS.filter(
            (area) => area.id === 'S06' || area.id === 'S09' || area.id === 'S14'
        )
    })

    const COMPANY_SHIP_MARKERS: ShipSeaMarker[] = $derived.by(() => {
        if (colorMode !== 'companies') {
            return []
        }
        const markers: ShipSeaMarker[] = []
        for (const [areaIndex, area] of SEA_DEBUG_MAP_AREAS.entries()) {
            const layout = getShipLayoutForSeaArea(area)
            for (const [markerIndex, point] of layout[companyShipMarkerCount].entries()) {
                markers.push({
                    id: `${area.id}-${companyShipMarkerCount}-${markerIndex}`,
                    x: point.x,
                    y: point.y,
                    style: (areaIndex + markerIndex) % 2 === 0 ? 'a' : 'b'
                })
            }
        }
        return markers
    })

    const SHIP_TUNE_MARKERS: ShipTuneMarker[] = $derived.by(() => {
        if (colorMode !== 'ships') {
            return []
        }
        const markers: ShipTuneMarker[] = []
        for (const seaArea of SEA_DEBUG_MAP_AREAS) {
            const layout = getShipLayoutForSeaArea(seaArea)
            for (const [markerIndex, point] of layout[shipMarkerCount].entries()) {
                markers.push({
                    id: `${seaArea.id}-${shipMarkerCount}-${markerIndex}`,
                    seaId: seaArea.id,
                    x: point.x,
                    y: point.y,
                    style: markerIndex % 2 === 0 ? 'a' : 'b',
                    index: markerIndex
                })
            }
        }
        return markers
    })

    const LAYOUT_SHIP_MARKERS: ShipTuneMarker[] = $derived.by(() => {
        if (colorMode !== 'layout' || !layoutShowShips) {
            return []
        }
        const markers: ShipTuneMarker[] = []
        for (const seaArea of SEA_DEBUG_MAP_AREAS) {
            const shipCount = getLayoutShipCountForSeaId(seaArea.id)
            const layout = getShipLayoutForSeaArea(seaArea)
            for (const [markerIndex, point] of layout[shipCount].entries()) {
                markers.push({
                    id: `${seaArea.id}-${shipCount}-${markerIndex}`,
                    seaId: seaArea.id,
                    x: point.x,
                    y: point.y,
                    style: markerIndex % 2 === 0 ? 'a' : 'b',
                    index: markerIndex
                })
            }
        }
        return markers
    })

    const SELECTED_SHIP_SEA_AREA: DebugArea | null = $derived.by(() => {
        if (!shipMarkerSelectedSeaId) {
            return null
        }
        return SEA_DEBUG_AREAS_BY_ID.get(shipMarkerSelectedSeaId) ?? null
    })

    const SELECTED_SHIP_MARKER_POINT: Point | null = $derived.by(() => {
        if (!shipMarkerSelectedSeaId) {
            return null
        }
        const layout = getShipLayoutForSeaId(shipMarkerSelectedSeaId)
        if (!layout) {
            return null
        }
        const points = layout[shipMarkerCount]
        if (shipMarkerSelectedIndex < 0 || shipMarkerSelectedIndex >= points.length) {
            return null
        }
        return points[shipMarkerSelectedIndex]
    })

    function formatShipPoints(points: Point[]): string {
        return points
            .map((point) => `{ x: ${point.x.toFixed(1)}, y: ${point.y.toFixed(1)} }`)
            .join(', ')
    }

    const SHIP_MARKER_OVERRIDES_EXPORT_TEXT: string = $derived.by(() => {
        const ids = Object.keys(shipMarkerPositions).sort(compareAreaIds)
        if (ids.length === 0) {
            return '// No ship marker overrides yet.'
        }
        const lines = ids.map((seaId) => {
            const seaArea = SEA_DEBUG_AREAS_BY_ID.get(seaId)
            if (!seaArea) {
                return ''
            }
            const layout = getShipLayoutForSeaArea(seaArea)
            return `    ${seaId}: {\n        1: [${formatShipPoints(layout[1])}],\n        2: [${formatShipPoints(layout[2])}],\n        3: [${formatShipPoints(layout[3])}]\n    },`
        })
        return `export const SEA_SHIP_MARKER_POSITIONS = {\n${lines.filter(Boolean).join('\n')}\n} as const`
    })

    const SHIP_MARKER_FULL_EXPORT_TEXT: string = $derived.by(() => {
        const lines = SEA_DEBUG_MAP_AREAS.map((seaArea) => {
            const layout = getShipLayoutForSeaArea(seaArea)
            return `    ${seaArea.id}: {\n        1: [${formatShipPoints(layout[1])}],\n        2: [${formatShipPoints(layout[2])}],\n        3: [${formatShipPoints(layout[3])}]\n    },`
        })
        return `export const SEA_SHIP_MARKER_POSITIONS = {\n${lines.join('\n')}\n} as const`
    })

    const REGION_LABELS: RegionLabel[] = $derived.by(() => {
        if (colorMode !== 'region') {
            return []
        }

        const grouped = new Map<string, DebugArea[]>()
        for (const area of LAND_DEBUG_MAP_AREAS) {
            if (!area.region) {
                continue
            }
            const group = grouped.get(area.region) ?? []
            group.push(area)
            grouped.set(area.region, group)
        }

        const labels: RegionLabel[] = []
        for (const [regionId, areas] of grouped.entries()) {
            if (areas.length === 0) {
                continue
            }

            const center = areas.reduce(
                (acc, area) => {
                    acc.x += area.labelX
                    acc.y += area.labelY
                    return acc
                },
                { x: 0, y: 0 }
            )

            labels.push({
                regionId,
                x: center.x / areas.length,
                y: center.y / areas.length
            })
        }

        labels.sort((left, right) => left.regionId.localeCompare(right.regionId))
        return labels
    })

    const SELECTED_MARKER_AREA: DebugArea | null = $derived.by(() => {
        if (!markerSelectedAreaId) {
            return null
        }
        return LAND_DEBUG_AREAS_BY_ID.get(markerSelectedAreaId) ?? null
    })

    const PRODUCTION_MARKER_BY_AREA: Map<string, ProductionMarkerType> = $derived.by(() => {
        const regionIds = [
            ...new Set(
                LAND_DEBUG_MAP_AREAS.map((area) => area.region).filter(
                    (regionId): regionId is string => regionId !== null
                )
            )
        ].sort((left, right) => left.localeCompare(right))

        const markerByRegion = new Map<string, ProductionMarkerType>()
        for (const [regionIndex, regionId] of regionIds.entries()) {
            markerByRegion.set(
                regionId,
                PRODUCTION_MARKER_TYPES[regionIndex % PRODUCTION_MARKER_TYPES.length]
            )
        }

        const markerByArea = new Map<string, ProductionMarkerType>()
        for (const [areaIndex, area] of LAND_DEBUG_MAP_AREAS.entries()) {
            if (area.region) {
                markerByArea.set(area.id, markerByRegion.get(area.region) ?? 'spice')
                continue
            }
            markerByArea.set(
                area.id,
                PRODUCTION_MARKER_TYPES[areaIndex % PRODUCTION_MARKER_TYPES.length]
            )
        }

        return markerByArea
    })

    function buildProductionMarkers(
        resolvePosition: (area: DebugArea) => Point
    ): ProductionMarkerPlacement[] {
        const placements: ProductionMarkerPlacement[] = []
        for (const area of LAND_DEBUG_MAP_AREAS) {
            const markerPosition = resolvePosition(area)
            if (area.id === 'A34') {
                placements.push({
                    areaId: area.id,
                    markerType: 'bead',
                    beadTone: 'green',
                    x: markerPosition.x,
                    y: markerPosition.y
                })
                continue
            }
            placements.push({
                areaId: area.id,
                markerType: PRODUCTION_MARKER_BY_AREA.get(area.id) ?? 'spice',
                x: markerPosition.x,
                y: markerPosition.y
            })
        }
        return placements
    }

    const PRODUCTION_MARKERS: ProductionMarkerPlacement[] = $derived.by(() =>
        buildProductionMarkers(getDefaultMarkerPositionForArea)
    )

    const MARKER_MODE_MARKERS: ProductionMarkerPlacement[] = $derived.by(() =>
        buildProductionMarkers(getMarkerPositionForArea)
    )

    const DISPLAYED_MARKERS: ProductionMarkerPlacement[] = $derived.by(() => {
        if (colorMode === 'marker') {
            return MARKER_MODE_MARKERS
        }
        return PRODUCTION_MARKERS
    })

    const CITY_DEMAND_TUNE_BASE_MARKERS: CityDemandTuneMarker[] = $derived.by(() => {
        const regions = [...INDONESIA_REGIONS].sort((left, right) =>
            left.id.localeCompare(right.id, undefined, { numeric: true })
        )
        const markers: CityDemandTuneMarker[] = []

        for (const region of regions) {
            const coastalAreas = Array.from(gameSession.gameState.board.coastalAreasForRegion(region.id))
                .map((area) => LAND_DEBUG_AREAS_BY_ID.get(area.id))
                .filter((area): area is DebugArea => area !== undefined)

            if (coastalAreas.length === 0) {
                continue
            }

            const anchorArea = coastalAreas[0]
            if (!anchorArea) {
                continue
            }

            const target = coastalAreas.reduce(
                (accumulator, area) => {
                    const position = getDefaultMarkerPositionForArea(area)
                    accumulator.x += position.x
                    accumulator.y += position.y
                    return accumulator
                },
                { x: 0, y: 0 }
            )
            const targetX = target.x / coastalAreas.length
            const targetY = target.y / coastalAreas.length

            const dx = targetX - CITY_DEMAND_TUNE_BOARD_CENTER.x
            const dy = targetY - CITY_DEMAND_TUNE_BOARD_CENTER.y
            const magnitude = Math.hypot(dx, dy)
            const ux = magnitude > 0.001 ? dx / magnitude : 0
            const uy = magnitude > 0.001 ? dy / magnitude : -1
            const tangentX = -uy
            const tangentY = ux
            const jitterSeed = hashStringToSeed(region.id)
            const jitter = ((jitterSeed % 5) - 2) * (CITY_DEMAND_TUNE_TAG_MAX_OFFSET / 2)
            const tunedPosition = CITY_DEMAND_MARKER_POSITIONS_BY_REGION[region.id]
            const markerX = tunedPosition?.x ?? targetX + ux * CITY_DEMAND_TUNE_TAG_DISTANCE + tangentX * jitter
            const markerY = tunedPosition?.y ?? targetY + uy * CITY_DEMAND_TUNE_TAG_DISTANCE + tangentY * jitter

            markers.push({
                key: region.id,
                regionId: region.id,
                areaId: anchorArea.id,
                x: markerX,
                y: markerY,
                targetX,
                targetY,
                demands: CITY_DEMAND_TUNE_GOOD_ORDER.map((good) => ({ good, count: 3 }))
            })
        }

        return markers
    })

    const CITY_DEMAND_TUNE_MARKERS: CityDemandTuneMarker[] = $derived.by(() => {
        if (
            colorMode !== 'citydemand' &&
            !(colorMode === 'layout' && layoutShowCityDemand)
        ) {
            return []
        }

        return CITY_DEMAND_TUNE_BASE_MARKERS.map((marker) => {
            const offset = cityDemandMarkerOffsets[marker.regionId] ?? { x: 0, y: 0 }
            return {
                ...marker,
                x: marker.x + offset.x,
                y: marker.y + offset.y
            }
        })
    })

    const SELECTED_CITY_DEMAND_TUNE_MARKER: CityDemandTuneMarker | null = $derived.by(() => {
        if (!cityDemandSelectedRegionId) {
            return null
        }
        return (
            CITY_DEMAND_TUNE_MARKERS.find((marker) => marker.regionId === cityDemandSelectedRegionId) ??
            null
        )
    })

    const CITY_DEMAND_MARKER_OVERRIDES_EXPORT_TEXT: string = $derived.by(() => {
        const regionIds = Object.keys(cityDemandMarkerOffsets).sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
        )
        if (regionIds.length === 0) {
            return '// No city demand marker overrides yet.'
        }

        const lines = regionIds.map((regionId) => {
            const offset = cityDemandMarkerOffsets[regionId]
            return `    '${regionId}': { x: ${offset.x.toFixed(1)}, y: ${offset.y.toFixed(1)} },`
        })
        return `export const CITY_DEMAND_MARKER_OFFSETS_BY_REGION = {\n${lines.join('\n')}\n} as const`
    })

    const CITY_DEMAND_MARKER_FULL_EXPORT_TEXT: string = $derived.by(() => {
        const lines = CITY_DEMAND_TUNE_MARKERS.slice()
            .sort((left, right) => left.regionId.localeCompare(right.regionId, undefined, { numeric: true }))
            .map(
                (marker) =>
                    `    '${marker.regionId}': { x: ${marker.x.toFixed(1)}, y: ${marker.y.toFixed(1)} },`
            )
        return `export const CITY_DEMAND_MARKER_POSITIONS_BY_REGION = {\n${lines.join('\n')}\n} as const`
    })

    const MARKER_OVERRIDES_EXPORT_TEXT: string = $derived.by(() => {
        const ids = Object.keys(markerPositions).sort(compareAreaIds)
        if (ids.length === 0) {
            return '// No marker overrides yet.'
        }
        const lines = ids.map((areaId) => {
            const point = markerPositions[areaId]
            return `    ${areaId}: { x: ${point.x.toFixed(1)}, y: ${point.y.toFixed(1)} },`
        })
        return `export const LAND_MARKER_POSITIONS = {\n${lines.join('\n')}\n} as const`
    })

    const MARKER_FULL_EXPORT_TEXT: string = $derived.by(() => {
        const lines = LAND_DEBUG_MAP_AREAS.map((area) => {
            const point = getMarkerPositionForArea(area)
            return `    ${area.id}: { x: ${point.x.toFixed(1)}, y: ${point.y.toFixed(1)} },`
        })
        return `export const LAND_MARKER_POSITIONS = {\n${lines.join('\n')}\n} as const`
    })

    function computeAdjacencyColorMap(
        areas: DebugArea[],
        adjacency: Map<string, Set<string>>
    ): Map<string, string> {
        const areaIdSet = new Set(areas.map((area) => area.id))
        const filteredAdjacency = new Map<string, Set<string>>()
        for (const id of areaIdSet) {
            const neighbors = adjacency.get(id) ?? new Set<string>()
            filteredAdjacency.set(
                id,
                new Set([...neighbors].filter((neighborId) => areaIdSet.has(neighborId)))
            )
        }

        const sortedIds = [...filteredAdjacency.keys()].sort((a, b) => {
            const degreeDiff =
                (filteredAdjacency.get(b)?.size ?? 0) - (filteredAdjacency.get(a)?.size ?? 0)
            if (degreeDiff !== 0) return degreeDiff
            return compareAreaIds(a, b)
        })

        const areaColors = new Map<string, string>()
        const colorUsage = new Map<string, number>()
        const colorCandidateCount = Math.max(sortedIds.length, DEBUG_PALETTE.length)

        for (const id of sortedIds) {
            const neighborColors = new Set(
                [...(filteredAdjacency.get(id) ?? [])]
                    .map((neighborId) => areaColors.get(neighborId))
                    .filter(Boolean)
            )

            let selectedColor: string | null = null
            let selectedColorUsage = Number.POSITIVE_INFINITY

            // Prefer unused colors first, then least-used colors, while still
            // respecting adjacency constraints.
            for (let colorIndex = 0; colorIndex < colorCandidateCount; colorIndex++) {
                const candidate = getPaletteColor(colorIndex)
                if (neighborColors.has(candidate)) {
                    continue
                }

                const usage = colorUsage.get(candidate) ?? 0
                if (usage < selectedColorUsage) {
                    selectedColor = candidate
                    selectedColorUsage = usage
                }
            }

            if (selectedColor === null) {
                selectedColor = getPaletteColor(colorCandidateCount)
            }

            areaColors.set(id, selectedColor)
            colorUsage.set(selectedColor, (colorUsage.get(selectedColor) ?? 0) + 1)
        }

        return areaColors
    }

    function computeRegionColorMap(areas: DebugArea[]): Map<string, string> {
        const regionIds = [
            ...new Set(
                areas
                    .map((area) => area.region)
                    .filter((regionId): regionId is string => regionId !== null)
            )
        ].sort((left, right) => left.localeCompare(right))

        const regionColorMap = new Map<string, string>()
        for (const [index, regionId] of regionIds.entries()) {
            regionColorMap.set(regionId, getPaletteColor(index))
        }

        const areaColors = new Map<string, string>()
        for (const area of areas) {
            if (!area.region) {
                areaColors.set(area.id, '#9ca3af')
                continue
            }
            areaColors.set(area.id, regionColorMap.get(area.region) ?? '#9ca3af')
        }

        return areaColors
    }

    function computeSequentialColorMap(areas: DebugArea[]): Map<string, string> {
        const areaColors = new Map<string, string>()
        for (const [index, area] of areas.entries()) {
            areaColors.set(area.id, getPaletteColor(index))
        }
        return areaColors
    }

    function computeMarkerTuneColorMap(areas: DebugArea[]): Map<string, string> {
        const areaColors = new Map<string, string>()
        for (const area of areas) {
            areaColors.set(area.id, area.id === markerSelectedAreaId ? '#f59e0b' : '#93c5fd')
        }
        return areaColors
    }

    const DEBUG_AREA_COLORS: Map<string, string> = $derived.by(() => {
        if (colorMode === 'none') {
            return new Map()
        }
        if (colorMode === 'production') {
            return new Map()
        }
        if (colorMode === 'companies') {
            return new Map()
        }
        if (colorMode === 'deeds') {
            return new Map()
        }
        if (colorMode === 'research') {
            return new Map()
        }
        if (colorMode === 'companymarkers') {
            return new Map()
        }
        if (colorMode === 'citydemand') {
            return new Map()
        }
        if (colorMode === 'layout') {
            return new Map()
        }
        if (colorMode === 'marker') {
            return computeMarkerTuneColorMap(DISPLAY_AREAS)
        }
        if (colorMode === 'sea') {
            return computeSequentialColorMap(DISPLAY_AREAS)
        }
        if (colorMode === 'ships') {
            return computeSequentialColorMap(DISPLAY_AREAS)
        }
        if (colorMode === 'region') {
            return computeRegionColorMap(DISPLAY_AREAS)
        }
        if (colorMode === 'coastal') {
            return computeAdjacencyColorMap(DISPLAY_AREAS, BOARD_ADJACENCY)
        }
        return computeAdjacencyColorMap(DISPLAY_AREAS, BOARD_ADJACENCY)
    })

    $effect(() => {
        active = colorMode !== 'none'
    })
</script>

<div class="pointer-events-none absolute inset-0 z-[2]">
    <div class="debug-controls">
        <button
            type="button"
            class:active={colorMode === 'none'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'none'
            }}
        >
            None
        </button>
        <button
            type="button"
            class:active={colorMode === 'land'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'land'
            }}
        >
            Land
        </button>
        <button
            type="button"
            class:active={colorMode === 'coastal'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'coastal'
            }}
        >
            Coastal
        </button>
        <button
            type="button"
            class:active={colorMode === 'region'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'region'
            }}
        >
            Region
        </button>
        <button
            type="button"
            class:active={colorMode === 'sea'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'sea'
            }}
        >
            Sea
        </button>
        <button
            type="button"
            class:active={colorMode === 'ships'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'ships'
            }}
        >
            Ships
        </button>
        <button
            type="button"
            class:active={colorMode === 'deeds'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'deeds'
            }}
        >
            Deeds
        </button>
        <button
            type="button"
            class:active={colorMode === 'production'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'production'
            }}
        >
            Production
        </button>
        <button
            type="button"
            class:active={colorMode === 'companies'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'companies'
            }}
        >
            Companies
        </button>
        <button
            type="button"
            class:active={colorMode === 'research'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'research'
            }}
        >
            Research
        </button>
        <button
            type="button"
            class:active={colorMode === 'marker'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'marker'
            }}
        >
            Markers
        </button>
        <button
            type="button"
            class:active={colorMode === 'companymarkers'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'companymarkers'
            }}
        >
            Company Markers
        </button>
        <button
            type="button"
            class:active={colorMode === 'citydemand'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'citydemand'
            }}
        >
            City Demand
        </button>
        <button
            type="button"
            class:active={colorMode === 'layout'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'layout'
            }}
        >
            Layout
        </button>
    </div>
    {#if colorMode === 'marker'}
        <div class="marker-tune-panel">
            <div class="marker-tune-title">Marker Placement</div>
            <div class="marker-tune-row">
                <span>Selected:</span>
                <strong>{markerSelectedAreaId ?? 'None'}</strong>
            </div>
            {#if SELECTED_MARKER_AREA}
                {@const selectedPoint = getMarkerPositionForArea(SELECTED_MARKER_AREA)}
                <div class="marker-tune-row">
                    <span>X:</span>
                    <code>{selectedPoint.x.toFixed(1)}</code>
                    <span>Y:</span>
                    <code>{selectedPoint.y.toFixed(1)}</code>
                </div>
            {/if}
            <div class="marker-tune-row marker-tune-buttons">
                <button type="button" onclick={clearSelectedMarkerOverride}>Clear Selected</button>
                <button type="button" onclick={clearAllMarkerOverrides}>Clear All</button>
            </div>
            <div class="marker-tune-row marker-tune-buttons">
                <button
                    type="button"
                    onclick={() => copyToClipboard(MARKER_OVERRIDES_EXPORT_TEXT, 'marker')}
                >
                    Copy Overrides
                </button>
                <button
                    type="button"
                    onclick={() => copyToClipboard(MARKER_FULL_EXPORT_TEXT, 'marker')}
                >
                    Copy Full
                </button>
            </div>
            <div class="marker-tune-row">
                <span>Overrides:</span>
                <strong>{Object.keys(markerPositions).length}</strong>
                {#if markerCopyStatus}
                    <em>{markerCopyStatus}</em>
                {/if}
            </div>
            <label class="marker-tune-label" for="marker-overrides-export">Overrides Export</label>
            <textarea id="marker-overrides-export" readonly value={MARKER_OVERRIDES_EXPORT_TEXT}
            ></textarea>
            <label class="marker-tune-label" for="marker-full-export">Full Export</label>
            <textarea id="marker-full-export" readonly value={MARKER_FULL_EXPORT_TEXT}></textarea>
        </div>
    {/if}
    {#if colorMode === 'ships'}
        <div class="marker-tune-panel">
            <div class="marker-tune-title">Ship Marker Placement</div>
            <div class="marker-tune-row">
                <span>Selected Sea:</span>
                <strong>{shipMarkerSelectedSeaId ?? 'None'}</strong>
            </div>
            <div class="marker-tune-row marker-tune-buttons">
                <span>Ship Count:</span>
                <button
                    type="button"
                    class:active={shipMarkerCount === 1}
                    onclick={() => selectShipMarkerCount(1)}
                >
                    1
                </button>
                <button
                    type="button"
                    class:active={shipMarkerCount === 2}
                    onclick={() => selectShipMarkerCount(2)}
                >
                    2
                </button>
                <button
                    type="button"
                    class:active={shipMarkerCount === 3}
                    onclick={() => selectShipMarkerCount(3)}
                >
                    3
                </button>
            </div>
            <div class="marker-tune-row">
                <span>Selected Ship:</span>
                <strong>#{shipMarkerSelectedIndex + 1}</strong>
            </div>
            {#if SELECTED_SHIP_MARKER_POINT}
                <div class="marker-tune-row">
                    <span>X:</span>
                    <code>{SELECTED_SHIP_MARKER_POINT.x.toFixed(1)}</code>
                    <span>Y:</span>
                    <code>{SELECTED_SHIP_MARKER_POINT.y.toFixed(1)}</code>
                </div>
            {/if}
            <div class="marker-tune-row marker-tune-buttons">
                <button type="button" onclick={clearSelectedShipMarkerOverride}
                    >Clear Selected</button
                >
                <button type="button" onclick={clearAllShipMarkerOverrides}>Clear All</button>
            </div>
            <div class="marker-tune-row marker-tune-buttons">
                <button
                    type="button"
                    onclick={() => copyToClipboard(SHIP_MARKER_OVERRIDES_EXPORT_TEXT, 'ship')}
                >
                    Copy Overrides
                </button>
                <button
                    type="button"
                    onclick={() => copyToClipboard(SHIP_MARKER_FULL_EXPORT_TEXT, 'ship')}
                >
                    Copy Full
                </button>
            </div>
            <div class="marker-tune-row">
                <span>Overrides:</span>
                <strong>{Object.keys(shipMarkerPositions).length}</strong>
                {#if shipMarkerCopyStatus}
                    <em>{shipMarkerCopyStatus}</em>
                {/if}
            </div>
            <label class="marker-tune-label" for="ship-overrides-export">Overrides Export</label>
            <textarea id="ship-overrides-export" readonly value={SHIP_MARKER_OVERRIDES_EXPORT_TEXT}
            ></textarea>
            <label class="marker-tune-label" for="ship-full-export">Full Export</label>
            <textarea id="ship-full-export" readonly value={SHIP_MARKER_FULL_EXPORT_TEXT}
            ></textarea>
        </div>
    {/if}
    {#if colorMode === 'deeds'}
        <div class="marker-tune-panel">
            <div class="marker-tune-title">Deed Card Placement</div>
            <div class="marker-tune-row marker-tune-buttons">
                <span>Era:</span>
                <button type="button" class:active={deedEra === Era.A} onclick={() => selectDeedEra(Era.A)}
                    >A</button
                >
                <button type="button" class:active={deedEra === Era.B} onclick={() => selectDeedEra(Era.B)}
                    >B</button
                >
                <button type="button" class:active={deedEra === Era.C} onclick={() => selectDeedEra(Era.C)}
                    >C</button
                >
            </div>
            <div class="marker-tune-row">
                <span>Selected:</span>
                <strong>{selectedDeedCardKey ?? 'None'}</strong>
            </div>
            {#if SELECTED_DEED_TUNE_ENTRY}
                <div class="marker-tune-row">
                    <span>Region:</span>
                    <strong>{SELECTED_DEED_TUNE_ENTRY.regionId}</strong>
                    <span>Type:</span>
                    <strong>{SELECTED_DEED_TUNE_ENTRY.deedType}</strong>
                    <span>Deed:</span>
                    <strong>{SELECTED_DEED_TUNE_ENTRY.deedId}</strong>
                </div>
                <div class="marker-tune-row">
                    <span>X:</span>
                    <code>{SELECTED_DEED_TUNE_ENTRY.x.toFixed(1)}</code>
                    <span>Y:</span>
                    <code>{SELECTED_DEED_TUNE_ENTRY.y.toFixed(1)}</code>
                </div>
            {/if}
            <div class="marker-tune-row marker-tune-buttons">
                <button type="button" onclick={clearSelectedDeedCardOverride}>Clear Selected</button>
                <button type="button" onclick={clearAllDeedCardOverrides}>Clear All</button>
            </div>
            <div class="marker-tune-row marker-tune-buttons">
                <button
                    type="button"
                    onclick={() => copyToClipboard(DEED_CARD_OVERRIDES_EXPORT_TEXT, 'deed')}
                >
                    Copy Overrides
                </button>
                <button type="button" onclick={() => copyToClipboard(DEED_CARD_FULL_EXPORT_TEXT, 'deed')}>
                    Copy Full
                </button>
            </div>
            <div class="marker-tune-row">
                <span>Overrides:</span>
                <strong>{Object.keys(deedCardPositions).length}</strong>
                {#if deedCardCopyStatus}
                    <em>{deedCardCopyStatus}</em>
                {/if}
            </div>
            <label class="marker-tune-label" for="deed-overrides-export">Overrides Export</label>
            <textarea id="deed-overrides-export" readonly value={DEED_CARD_OVERRIDES_EXPORT_TEXT}
            ></textarea>
            <label class="marker-tune-label" for="deed-full-export">Full Export</label>
            <textarea id="deed-full-export" readonly value={DEED_CARD_FULL_EXPORT_TEXT}></textarea>
        </div>
    {/if}
    {#if colorMode === 'companymarkers'}
        <div class="marker-tune-panel">
            <div class="marker-tune-title">Zone Marker Placement</div>
            <div class="marker-tune-row">
                <span>Selected Deed:</span>
                <strong>{selectedProductionZoneMarkerDeedId ?? 'None'}</strong>
            </div>
            {#if SELECTED_PRODUCTION_ZONE_MARKER_ENTRY}
                {@const selectedEffectiveOffsetX =
                    roundToTenth(
                        SELECTED_PRODUCTION_ZONE_MARKER_ENTRY.x -
                            SELECTED_PRODUCTION_ZONE_MARKER_ENTRY.baseX
                    )}
                {@const selectedEffectiveOffsetY =
                    roundToTenth(
                        SELECTED_PRODUCTION_ZONE_MARKER_ENTRY.y -
                            SELECTED_PRODUCTION_ZONE_MARKER_ENTRY.baseY
                    )}
                <div class="marker-tune-row">
                    <span>Region:</span>
                    <strong>{SELECTED_PRODUCTION_ZONE_MARKER_ENTRY.regionId}</strong>
                </div>
                <div class="marker-tune-row">
                    <span>X:</span>
                    <code>{SELECTED_PRODUCTION_ZONE_MARKER_ENTRY.x.toFixed(1)}</code>
                    <span>Y:</span>
                    <code>{SELECTED_PRODUCTION_ZONE_MARKER_ENTRY.y.toFixed(1)}</code>
                </div>
                <div class="marker-tune-row">
                    <span>Offset X:</span>
                    <code>{selectedEffectiveOffsetX.toFixed(1)}</code>
                    <span>Offset Y:</span>
                    <code>{selectedEffectiveOffsetY.toFixed(1)}</code>
                </div>
            {/if}
            <div class="marker-tune-row marker-tune-buttons">
                <button type="button" onclick={clearSelectedProductionZoneMarkerOverride}
                    >Clear Selected</button
                >
                <button type="button" onclick={clearAllProductionZoneMarkerOverrides}
                    >Clear All</button
                >
            </div>
            <div class="marker-tune-row marker-tune-buttons">
                <button
                    type="button"
                    onclick={() =>
                        copyToClipboard(
                            PRODUCTION_ZONE_MARKER_OVERRIDES_EXPORT_TEXT,
                            'companymarker'
                        )}
                >
                    Copy Overrides
                </button>
                <button
                    type="button"
                    onclick={() =>
                        copyToClipboard(PRODUCTION_ZONE_MARKER_FULL_EXPORT_TEXT, 'companymarker')}
                >
                    Copy Full
                </button>
            </div>
            <div class="marker-tune-row">
                <span>Overrides:</span>
                <strong>{Object.keys(productionZoneMarkerOffsets).length}</strong>
                <span>Visible:</span>
                <strong>{DEBUG_PRODUCTION_DEED_MARKERS.length}</strong>
                {#if productionZoneMarkerCopyStatus}
                    <em>{productionZoneMarkerCopyStatus}</em>
                {/if}
            </div>
            <label class="marker-tune-label" for="company-marker-overrides-export"
                >Overrides Export</label
            >
            <textarea
                id="company-marker-overrides-export"
                readonly
                value={PRODUCTION_ZONE_MARKER_OVERRIDES_EXPORT_TEXT}
            ></textarea>
            <label class="marker-tune-label" for="company-marker-full-export">Full Export</label>
            <textarea
                id="company-marker-full-export"
                readonly
                value={PRODUCTION_ZONE_MARKER_FULL_EXPORT_TEXT}
            ></textarea>
        </div>
    {/if}
    {#if colorMode === 'citydemand'}
        <div class="marker-tune-panel">
            <div class="marker-tune-title">City Demand Tag Tuner</div>
            <div class="marker-tune-row">
                <span>Rendered Regions:</span>
                <strong>{CITY_DEMAND_TUNE_MARKERS.length}</strong>
            </div>
            <div class="marker-tune-row">
                <span>Selected:</span>
                <strong>{cityDemandSelectedRegionId ?? 'None'}</strong>
            </div>
            {#if SELECTED_CITY_DEMAND_TUNE_MARKER}
                <div class="marker-tune-row">
                    <span>X:</span>
                    <code>{SELECTED_CITY_DEMAND_TUNE_MARKER.x.toFixed(1)}</code>
                    <span>Y:</span>
                    <code>{SELECTED_CITY_DEMAND_TUNE_MARKER.y.toFixed(1)}</code>
                </div>
            {/if}
            <div class="marker-tune-row marker-tune-buttons">
                <button type="button" onclick={clearSelectedCityDemandMarkerOverride}
                    >Clear Selected</button
                >
                <button type="button" onclick={clearAllCityDemandMarkerOverrides}>Clear All</button>
            </div>
            <div class="marker-tune-row marker-tune-buttons">
                <button
                    type="button"
                    onclick={() =>
                        copyToClipboard(CITY_DEMAND_MARKER_OVERRIDES_EXPORT_TEXT, 'citydemand')}
                >
                    Copy Overrides
                </button>
                <button
                    type="button"
                    onclick={() => copyToClipboard(CITY_DEMAND_MARKER_FULL_EXPORT_TEXT, 'citydemand')}
                >
                    Copy Full
                </button>
            </div>
            <div class="marker-tune-row">
                <span>Display:</span>
                <strong>One demand strip per city-eligible region</strong>
            </div>
            <div class="marker-tune-row">
                <span>Overrides:</span>
                <strong>{Object.keys(cityDemandMarkerOffsets).length}</strong>
                {#if cityDemandCopyStatus}
                    <em>{cityDemandCopyStatus}</em>
                {/if}
            </div>
            <label class="marker-tune-label" for="city-demand-overrides-export"
                >Overrides Export</label
            >
            <textarea
                id="city-demand-overrides-export"
                readonly
                value={CITY_DEMAND_MARKER_OVERRIDES_EXPORT_TEXT}
            ></textarea>
            <label class="marker-tune-label" for="city-demand-full-export">Full Export</label>
            <textarea
                id="city-demand-full-export"
                readonly
                value={CITY_DEMAND_MARKER_FULL_EXPORT_TEXT}
            ></textarea>
        </div>
    {/if}
    {#if colorMode === 'layout'}
        <div class="marker-tune-panel layout-composite-panel">
            <div class="marker-tune-title">Composite Layout</div>
            <div class="marker-tune-row marker-tune-buttons">
                <button type="button" class:active={layoutShowShips} onclick={() => (layoutShowShips = !layoutShowShips)}>
                    Ships
                </button>
                <button type="button" class:active={layoutShowDeeds} onclick={() => (layoutShowDeeds = !layoutShowDeeds)}>
                    Deeds
                </button>
                <button type="button" class:active={layoutShowTags} onclick={() => (layoutShowTags = !layoutShowTags)}>
                    Tags
                </button>
                <button
                    type="button"
                    class:active={layoutShowCityDemand}
                    onclick={() => (layoutShowCityDemand = !layoutShowCityDemand)}
                >
                    City Demand
                </button>
            </div>
            {#if layoutShowShips}
                <div class="marker-tune-row marker-tune-buttons">
                    <span>All Seas:</span>
                    <button type="button" onclick={() => setLayoutShipCountForAll(1)}>1</button>
                    <button type="button" onclick={() => setLayoutShipCountForAll(2)}>2</button>
                    <button type="button" onclick={() => setLayoutShipCountForAll(3)}>3</button>
                </div>
                <div class="layout-ship-count-grid">
                    {#each SEA_DEBUG_MAP_AREAS as seaArea (seaArea.id)}
                        {@const seaShipCount = getLayoutShipCountForSeaId(seaArea.id)}
                        <div class="layout-ship-count-row">
                            <span>{seaArea.id}</span>
                            <div class="marker-tune-buttons">
                                <button
                                    type="button"
                                    class:active={seaShipCount === 1}
                                    onclick={() => setLayoutShipCountForSeaId(seaArea.id, 1)}
                                >
                                    1
                                </button>
                                <button
                                    type="button"
                                    class:active={seaShipCount === 2}
                                    onclick={() => setLayoutShipCountForSeaId(seaArea.id, 2)}
                                >
                                    2
                                </button>
                                <button
                                    type="button"
                                    class:active={seaShipCount === 3}
                                    onclick={() => setLayoutShipCountForSeaId(seaArea.id, 3)}
                                >
                                    3
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
            <div class="marker-tune-row">
                <span>Rendered:</span>
                <strong>
                    {layoutShowShips ? LAYOUT_SHIP_MARKERS.length : 0}
                </strong>
                <span>ships</span>
                <strong>
                    {layoutShowDeeds ? ALL_DEED_TUNE_ENTRIES.length : 0}
                </strong>
                <span>deeds</span>
                <strong>
                    {layoutShowTags ? DEBUG_PRODUCTION_DEED_MARKERS.length : 0}
                </strong>
                <span>tags</span>
                <strong>
                    {layoutShowCityDemand ? CITY_DEMAND_TUNE_MARKERS.length : 0}
                </strong>
                <span>city-demand</span>
            </div>
        </div>
    {/if}
    {#if colorMode === 'companies'}
        <div class="companies-ship-count-panel">
            <div class="marker-tune-title">Company Ships</div>
            <div class="marker-tune-row marker-tune-buttons">
                <span>Ship Count:</span>
                <button
                    type="button"
                    class:active={companyShipMarkerCount === 1}
                    onclick={() => selectCompanyShipMarkerCount(1)}
                >
                    1
                </button>
                <button
                    type="button"
                    class:active={companyShipMarkerCount === 2}
                    onclick={() => selectCompanyShipMarkerCount(2)}
                >
                    2
                </button>
                <button
                    type="button"
                    class:active={companyShipMarkerCount === 3}
                    onclick={() => selectCompanyShipMarkerCount(3)}
                >
                    3
                </button>
            </div>
        </div>
    {/if}

    <svg
        bind:this={debugSvgElement}
        class="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Indonesia board debug overlay"
        pointer-events={colorMode === 'none' ? 'none' : 'auto'}
        onpointermove={handleMarkerPointerMove}
        onpointerup={stopMarkerDrag}
        onpointercancel={stopMarkerDrag}
        onpointerleave={stopMarkerDrag}
    >
        <g aria-label="Debug map geometry">
            {#each DISPLAY_AREAS as area (area.id)}
                {@const areaColor = DEBUG_AREA_COLORS.get(area.id) ?? '#ff1e1e'}
                <Area
                    areaId={area.id}
                    fill={areaColor}
                    fillOpacity={colorMode === 'marker' || colorMode === 'ships' ? '0.22' : '0.5'}
                    fillRule="evenodd"
                    stroke="#111827"
                    strokeWidth="1.8"
                    strokeLineJoin="round"
                    strokeLineCap="round"
                    opacity="0.95"
                    pointer-events={colorMode === 'sea' ||
                    colorMode === 'marker' ||
                    colorMode === 'ships'
                        ? 'all'
                        : 'none'}
                    onmouseenter={() => {
                        if (colorMode === 'sea') {
                            hoveredSeaId = area.id
                        }
                    }}
                    onmouseleave={() => {
                        if (colorMode === 'sea' && hoveredSeaId === area.id) {
                            hoveredSeaId = null
                        }
                    }}
                    onpointerdown={() => {
                        if (colorMode === 'marker') {
                            markerSelectedAreaId = area.id
                        } else if (colorMode === 'ships') {
                            shipMarkerSelectedSeaId = area.id
                            shipMarkerSelectedIndex = 0
                        }
                    }}
                />
            {/each}
            {#if colorMode === 'marker' && SELECTED_MARKER_AREA}
                <Area
                    areaId={SELECTED_MARKER_AREA.id}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.6"
                    strokeLineJoin="round"
                    strokeLineCap="round"
                    opacity="0.95"
                    pointer-events="none"
                />
            {/if}
            {#if colorMode === 'ships' && SELECTED_SHIP_SEA_AREA}
                <Area
                    areaId={SELECTED_SHIP_SEA_AREA.id}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.6"
                    strokeLineJoin="round"
                    strokeLineCap="round"
                    opacity="0.95"
                    pointer-events="none"
                />
            {/if}
            {#if colorMode === 'companies'}
                {#each COMPANY_SHIP_SEA_AREAS as area (area.id)}
                    <Area
                        areaId={area.id}
                        fill={SHIP_OVERLAY_LIGHT}
                        fillOpacity="1"
                        fillRule="evenodd"
                        stroke={SHIP_OVERLAY_DARK}
                        strokeWidth="1.9"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity="0.8"
                        pointer-events="none"
                    />
                {/each}
                {#each COMPANY_R03_AREAS as area (area.id)}
                    <Area
                        areaId={area.id}
                        fill={RUBBER_OVERLAY_LIGHT}
                        fillOpacity="1"
                        fillRule="evenodd"
                        stroke={RUBBER_OVERLAY_DARK}
                        strokeWidth="1.9"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity="0.8"
                        pointer-events="none"
                    />
                {/each}
                {#each COMPANY_R04_AREAS as area (area.id)}
                    <Area
                        areaId={area.id}
                        fill={RUBBER_OVERLAY_LIGHT}
                        fillOpacity="1"
                        fillRule="evenodd"
                        stroke={RUBBER_OVERLAY_DARK}
                        strokeWidth="1.9"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity="0.8"
                        pointer-events="none"
                    />
                {/each}
                {#each COMPANY_R10_AREAS as area (area.id)}
                    <Area
                        areaId={area.id}
                        fill={RUBBER_OVERLAY_LIGHT}
                        fillOpacity="1"
                        fillRule="evenodd"
                        stroke={RUBBER_OVERLAY_DARK}
                        strokeWidth="1.9"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity="0.8"
                        pointer-events="none"
                    />
                {/each}
                {#each COMPANY_R19_AREAS as area (area.id)}
                    <Area
                        areaId={area.id}
                        fill={SPICE_OVERLAY_LIGHT}
                        fillOpacity="1"
                        fillRule="evenodd"
                        stroke={SPICE_OVERLAY_DARK}
                        strokeWidth="1.9"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity="0.8"
                        pointer-events="none"
                    />
                {/each}
                {#each COMPANY_R01_AREAS as area (area.id)}
                    <Area
                        areaId={area.id}
                        fill={COMPANY_OVERLAY_LIGHT}
                        fillOpacity="1"
                        fillRule="evenodd"
                        stroke={COMPANY_OVERLAY_DARK}
                        strokeWidth="1.9"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity="0.8"
                        pointer-events="none"
                    />
                {/each}
                {#each COMPANY_SHIP_MARKERS as shipMarker (shipMarker.id)}
                    <ShipMarker
                        x={shipMarker.x}
                        y={shipMarker.y}
                        style={shipMarker.style}
                        height={SHIP_MARKER_HEIGHT}
                    />
                {/each}
                <CompanyDeed type="rubber" x={200} y={680} height={58} text="Sumatera Barat" />
                <CompanyDeed
                    type="rubber"
                    x={COMPANIES_RUBBER_CARD_A26_X}
                    y={COMPANIES_RUBBER_CARD_A26_Y}
                    height={58}
                    text="Riau"
                />
                <CompanyDeed
                    type="rubber"
                    x={COMPANIES_RUBBER_CARD_B02_X}
                    y={COMPANIES_RUBBER_CARD_B02_Y}
                    height={58}
                    text="Kalimantan Barat"
                />
                <CompanyDeed
                    type="spice"
                    x={COMPANIES_SPICE_CARD_C09_X}
                    y={COMPANIES_SPICE_CARD_C09_Y}
                    height={58}
                    text="Jawa Tengah"
                />
                <CompanyDeed type="ship" x={COMPANIES_SHIP_CARD_A10_X} y={COMPANIES_SHIP_CARD_A10_Y} height={58} />
                <CompanyDeed type="rice" x={45} y={250} height={58} text="Areh" />
            {/if}
            {#if colorMode === 'companymarkers'}
                {#each DEBUG_PRODUCTION_DEED_MARKERS as marker (marker.key)}
                    <CompanyZoneMarker
                        x={marker.x}
                        y={marker.y}
                        targetX={marker.targetX}
                        targetY={marker.targetY}
                        playerColor={marker.ownerColor}
                        goodType={marker.goodType}
                        goodsCount={marker.goodsCount}
                        hatchPatternId={marker.hatchPatternId}
                        direction={marker.direction}
                    />
                    <path
                        d={`M ${marker.x} ${marker.y} L ${marker.targetX} ${marker.targetY}`}
                        fill="none"
                        stroke={shadeHexColor(marker.ownerColor, 0.28)}
                        stroke-width="1.8"
                        stroke-linejoin="round"
                        stroke-linecap="round"
                        opacity="0.75"
                        pointer-events="none"
                    />
                    <circle
                        cx={marker.targetX}
                        cy={marker.targetY}
                        r="3.2"
                        fill="#f8fafc"
                        stroke={shadeHexColor(marker.ownerColor, 0.35)}
                        stroke-width="1.4"
                        opacity="0.85"
                        pointer-events="none"
                    ></circle>
                    <circle
                        cx={marker.x}
                        cy={marker.y}
                        r={marker.deedId === selectedProductionZoneMarkerDeedId ? 8 : 6.5}
                        fill={marker.deedId === selectedProductionZoneMarkerDeedId ? '#fef3c7' : '#ffffff'}
                        fill-opacity="0.38"
                        stroke={marker.deedId === selectedProductionZoneMarkerDeedId ? '#b45309' : '#1f2937'}
                        stroke-width={marker.deedId === selectedProductionZoneMarkerDeedId ? 2.2 : 1.5}
                        pointer-events="all"
                        onpointerdown={(event) => startProductionZoneMarkerDrag(marker.deedId, event)}
                    ></circle>
                    <text
                        x={marker.x}
                        y={marker.y - 12}
                        fill={shadeHexColor(marker.ownerColor, 0.48)}
                        stroke="#ffffff"
                        stroke-width="1"
                        paint-order="stroke fill"
                        font-size="11"
                        font-weight="700"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        pointer-events="none"
                    >
                        {marker.regionId}
                    </text>
                {/each}
            {/if}
            {#if colorMode === 'layout' && layoutShowTags}
                {#each DEBUG_PRODUCTION_DEED_MARKERS as marker (marker.key)}
                    <CompanyZoneMarker
                        x={marker.x}
                        y={marker.y}
                        targetX={marker.targetX}
                        targetY={marker.targetY}
                        playerColor={marker.ownerColor}
                        goodType={marker.goodType}
                        goodsCount={marker.goodsCount}
                        hatchPatternId={marker.hatchPatternId}
                        direction={marker.direction}
                    />
                {/each}
            {/if}
            {#if colorMode === 'citydemand' || (colorMode === 'layout' && layoutShowCityDemand)}
                {#each CITY_DEMAND_TUNE_MARKERS as marker (marker.key)}
                    <CityDemandMarker
                        x={marker.x}
                        y={marker.y}
                        targetX={marker.targetX}
                        targetY={marker.targetY}
                        demands={marker.demands}
                    />
                    {#if colorMode === 'citydemand'}
                        <circle
                            cx={marker.x}
                            cy={marker.y}
                            r={marker.regionId === cityDemandSelectedRegionId ? 8 : 6.5}
                            fill={marker.regionId === cityDemandSelectedRegionId ? '#fef3c7' : '#ffffff'}
                            fill-opacity="0.36"
                            stroke={marker.regionId === cityDemandSelectedRegionId ? '#b45309' : '#1f2937'}
                            stroke-width={marker.regionId === cityDemandSelectedRegionId ? 2.2 : 1.5}
                            pointer-events="all"
                            onpointerdown={(event) => startCityDemandMarkerDrag(marker.regionId, event)}
                        ></circle>
                        <text
                            x={marker.targetX}
                            y={marker.targetY - 14}
                            fill="#111827"
                            stroke="#ffffff"
                            stroke-width="1.2"
                            paint-order="stroke fill"
                            font-size="11"
                            font-weight="700"
                            text-anchor="middle"
                            dominant-baseline="middle"
                            pointer-events="none"
                        >
                            {marker.regionId}
                        </text>
                    {/if}
                {/each}
            {/if}
            {#if colorMode === 'deeds' || colorMode === 'ships' || (colorMode === 'layout' && layoutShowDeeds)}
                {#each (colorMode === 'deeds' ? DEED_TUNE_ENTRIES : ALL_DEED_TUNE_ENTRIES) as deed (deed.positionKey)}
                    <CompanyDeed
                        type={deed.cardKind}
                        x={deed.x}
                        y={deed.y}
                        height={DEED_CARD_HEIGHT}
                        text={deed.regionName}
                        shippingSizes={deed.shippingSizes}
                    />
                    {#if colorMode === 'deeds'}
                        <circle
                            cx={deed.x + DEED_CARD_HANDLE_OFFSET}
                            cy={deed.y + DEED_CARD_HANDLE_OFFSET}
                            r={deed.positionKey === selectedDeedCardKey ? 8 : 6.5}
                            fill={deed.positionKey === selectedDeedCardKey ? '#fef3c7' : '#ffffff'}
                            fill-opacity="0.35"
                            stroke={deed.positionKey === selectedDeedCardKey ? '#b45309' : '#1f2937'}
                            stroke-width={deed.positionKey === selectedDeedCardKey ? 2.2 : 1.5}
                            pointer-events="all"
                            onpointerdown={(event) => startDeedCardDrag(deed.positionKey, event)}
                        ></circle>
                    {/if}
                {/each}
            {/if}
            {#if colorMode === 'ships' || (colorMode === 'layout' && layoutShowShips)}
                {#each (colorMode === 'ships' ? SHIP_TUNE_MARKERS : LAYOUT_SHIP_MARKERS) as shipMarker (shipMarker.id)}
                    <ShipMarker
                        x={shipMarker.x}
                        y={shipMarker.y}
                        style={shipMarker.style}
                        height={SHIP_MARKER_HEIGHT}
                    />
                    {#if colorMode === 'ships'}
                        <text
                            x={shipMarker.x}
                            y={shipMarker.y + 20}
                            fill="#111827"
                            stroke="#f8fafc"
                            stroke-width="1.25"
                            paint-order="stroke fill"
                            font-size="13"
                            font-weight="800"
                            text-anchor="middle"
                            dominant-baseline="middle"
                            pointer-events="none"
                        >
                            {shipMarker.index + 1}
                        </text>
                    {/if}
                    {#if colorMode === 'ships'}
                        <circle
                            cx={shipMarker.x}
                            cy={shipMarker.y}
                            r={shipMarker.seaId === shipMarkerSelectedSeaId &&
                            shipMarker.index === shipMarkerSelectedIndex
                                ? 8
                                : 6.5}
                            fill={shipMarker.seaId === shipMarkerSelectedSeaId &&
                            shipMarker.index === shipMarkerSelectedIndex
                                ? '#fef3c7'
                                : '#ffffff'}
                            fill-opacity="0.35"
                            stroke={shipMarker.seaId === shipMarkerSelectedSeaId &&
                            shipMarker.index === shipMarkerSelectedIndex
                                ? '#b45309'
                                : '#1f2937'}
                            stroke-width={shipMarker.seaId === shipMarkerSelectedSeaId &&
                            shipMarker.index === shipMarkerSelectedIndex
                                ? 2.2
                                : 1.5}
                            pointer-events="all"
                            onpointerdown={(event) =>
                                startShipMarkerDrag(shipMarker.seaId, shipMarker.index, event)}
                        ></circle>
                    {/if}
                {/each}
            {/if}
            {#if colorMode === 'production' || colorMode === 'marker'}
                {#each DISPLAYED_MARKERS as marker (marker.areaId)}
                    {#if marker.markerType === 'bead'}
                        <GlassBeadMarker
                            x={marker.x}
                            y={marker.y}
                            height={GLASS_BEAD_HEIGHT}
                            tone={marker.beadTone ?? 'green'}
                            opacity={GLASS_BEAD_OPACITY}
                        />
                    {:else if marker.markerType === 'spice'}
                        <SpiceMarker x={marker.x} y={marker.y} height={PRODUCTION_ICON_HEIGHT} />
                    {:else if marker.markerType === 'siapsaji'}
                        <SiapSajiMarker x={marker.x} y={marker.y} height={PRODUCTION_ICON_HEIGHT} />
                    {:else if marker.markerType === 'oil'}
                        <OilMarker x={marker.x} y={marker.y} height={PRODUCTION_ICON_HEIGHT} />
                    {:else if marker.markerType === 'rice'}
                        <RiceMarker x={marker.x} y={marker.y} height={PRODUCTION_ICON_HEIGHT} />
                    {:else}
                        <RubberMarker x={marker.x} y={marker.y} height={PRODUCTION_ICON_HEIGHT} />
                    {/if}
                    {#if colorMode === 'marker'}
                        <circle
                            cx={marker.x}
                            cy={marker.y}
                            r={marker.areaId === markerSelectedAreaId ? 8 : 6.5}
                            fill={marker.areaId === markerSelectedAreaId ? '#fef3c7' : '#ffffff'}
                            fill-opacity="0.35"
                            stroke={marker.areaId === markerSelectedAreaId ? '#b45309' : '#1f2937'}
                            stroke-width={marker.areaId === markerSelectedAreaId ? 2.2 : 1.5}
                            pointer-events="all"
                            onpointerdown={(event) => startMarkerDrag(marker.areaId, event)}
                        ></circle>
                    {/if}
                {/each}
            {/if}
            {#if colorMode === 'research'}
                {#each RESEARCH_TRACK_CELLS as slot (slot.id)}
                    <rect
                        x={slot.left}
                        y={slot.top}
                        width={slot.width}
                        height={slot.height}
                        fill="none"
                        stroke={DEBUG_RESEARCH_SLOT_OUTLINE_COLOR}
                        stroke-width={DEBUG_RESEARCH_SLOT_OUTLINE_WIDTH}
                        opacity={DEBUG_RESEARCH_SLOT_OUTLINE_OPACITY}
                        pointer-events="none"
                    ></rect>
                {/each}
                {#each DEBUG_RESEARCH_CUBES as cube (cube.key)}
                    <CubeMarker
                        x={cube.x}
                        y={cube.y}
                        size={DEBUG_RESEARCH_CUBE_SIZE}
                        color={cube.color}
                        rotationDegrees={cube.rotationDegrees}
                    />
                {/each}
            {/if}
            {#if colorMode === 'sea'}
                {#each HOVERED_SEA_LAND_AREAS as area (area.id)}
                    <Area
                        areaId={area.id}
                        fill="#fde68a"
                        fillOpacity="0.68"
                        stroke="#92400e"
                        strokeWidth="2.2"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity="0.95"
                        pointer-events="none"
                    />
                {/each}
            {/if}
            {#each DEBUG_CONNECTIONS as connection (connection.id)}
                <line
                    x1={connection.x1}
                    y1={connection.y1}
                    x2={connection.x2}
                    y2={connection.y2}
                    stroke="#374151"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    opacity="0.85"
                    pointer-events="none"
                ></line>
            {/each}
            {#each DISPLAY_AREAS as area (area.id)}
                <text
                    x={area.labelX}
                    y={area.labelY}
                    fill="#111827"
                    stroke="#ffffff"
                    stroke-width="1.3"
                    paint-order="stroke fill"
                    font-size="14"
                    font-weight="700"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    pointer-events="none"
                >
                    {area.label}
                </text>
            {/each}
            {#if colorMode === 'region'}
                {#each REGION_LABELS as regionLabel (regionLabel.regionId)}
                    <text
                        x={regionLabel.x}
                        y={regionLabel.y}
                        fill="#7c2d12"
                        stroke="#ffffff"
                        stroke-width="1.6"
                        paint-order="stroke fill"
                        font-size="18"
                        font-weight="800"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        pointer-events="none"
                    >
                        {regionLabel.regionId}
                    </text>
                {/each}
            {/if}
            {#if colorMode === 'sea'}
                {#each HOVERED_SEA_LAND_AREAS as area (area.id)}
                    <text
                        x={area.labelX}
                        y={area.labelY}
                        fill="#78350f"
                        stroke="#fef3c7"
                        stroke-width="1.1"
                        paint-order="stroke fill"
                        font-size="12"
                        font-weight="700"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        pointer-events="none"
                    >
                        {area.label}
                    </text>
                {/each}
            {/if}
        </g>
    </svg>
</div>

<style>
    .debug-controls,
    .marker-tune-panel,
    .companies-ship-count-panel {
        pointer-events: auto;
    }

    .debug-controls {
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 4;
        display: inline-flex;
        gap: 6px;
        padding: 6px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.85);
        box-shadow: 0 1px 3px rgba(17, 24, 39, 0.18);
    }

    .debug-controls button {
        border: 1px solid rgba(17, 24, 39, 0.25);
        background: rgba(255, 255, 255, 0.65);
        color: #111827;
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
    }

    .debug-controls button.active {
        background: #1f2937;
        color: #ffffff;
        border-color: #111827;
    }

    .marker-tune-panel {
        position: absolute;
        bottom: 12px;
        left: 12px;
        z-index: 4;
        width: 340px;
        display: grid;
        gap: 8px;
        padding: 10px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 1px 3px rgba(17, 24, 39, 0.22);
        border: 1px solid rgba(17, 24, 39, 0.12);
    }

    .companies-ship-count-panel {
        position: absolute;
        top: 62px;
        left: 12px;
        z-index: 4;
        display: grid;
        gap: 8px;
        padding: 10px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 1px 3px rgba(17, 24, 39, 0.22);
        border: 1px solid rgba(17, 24, 39, 0.12);
    }

    .layout-composite-panel {
        width: 420px;
        max-height: 540px;
        overflow-y: auto;
    }

    .layout-ship-count-grid {
        display: grid;
        gap: 4px;
        max-height: 260px;
        overflow-y: auto;
        border: 1px solid rgba(17, 24, 39, 0.14);
        border-radius: 8px;
        padding: 6px;
        background: rgba(255, 255, 255, 0.82);
    }

    .layout-ship-count-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        color: #1f2937;
    }

    .marker-tune-title {
        font-size: 13px;
        font-weight: 700;
        color: #111827;
    }

    .marker-tune-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #1f2937;
    }

    .marker-tune-row code {
        font-family:
            ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
        font-size: 12px;
        padding: 1px 4px;
        border-radius: 4px;
        background: rgba(15, 23, 42, 0.06);
    }

    .marker-tune-row em {
        color: #0f766e;
        font-style: normal;
        font-weight: 700;
    }

    .marker-tune-buttons {
        gap: 6px;
    }

    .marker-tune-buttons button {
        border: 1px solid rgba(17, 24, 39, 0.25);
        background: rgba(255, 255, 255, 0.78);
        color: #111827;
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.1;
        cursor: pointer;
    }

    .marker-tune-buttons button.active {
        background: #1f2937;
        color: #ffffff;
        border-color: #111827;
    }

    .marker-tune-label {
        font-size: 11px;
        color: #374151;
        font-weight: 600;
    }

    .marker-tune-panel textarea {
        width: 100%;
        min-height: 84px;
        resize: vertical;
        font-family:
            ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
        font-size: 11px;
        line-height: 1.35;
        border: 1px solid rgba(17, 24, 39, 0.25);
        border-radius: 8px;
        padding: 6px 8px;
        background: rgba(255, 255, 255, 0.95);
        color: #111827;
    }
</style>

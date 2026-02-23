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
    import ShipMarker from '$lib/components/ShipMarker.svelte'
    import GlassBeadMarker from '$lib/components/GlassBeadMarker.svelte'
    import CompanyCard from '$lib/components/CompanyCard.svelte'
    import { DEED_CARD_POSITIONS, DEED_CARD_POSITIONS_STORAGE_KEY } from '$lib/definitions/deedCardPositions.js'
    import { LAND_MARKER_POSITIONS } from '$lib/definitions/landMarkerPositions.js'
    import { SEA_SHIP_MARKER_POSITIONS } from '$lib/definitions/seaShipMarkerPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { CompanyType, Deeds, Era, Good, INDONESIA_REGIONS, type AnyDeed } from '@tabletop/indonesia'

    const gameSession = getGameSession()

    let { width, height }: { width: number; height: number } = $props()

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
        | 'marker'
    type BeadTone = 'amber' | 'red' | 'green'
    let colorMode: OverlayMode = $state('none')
    let hoveredSeaId: string | null = $state(null)
    let debugSvgElement: SVGSVGElement | null = $state(null)
    let markerPositions: Record<string, { x: number; y: number }> = $state({})
    let markerPositionsLoaded = $state(false)
    let markerSelectedAreaId: string | null = $state(null)
    let markerDraggingAreaId: string | null = $state(null)
    let markerCopyStatus: string | null = $state(null)
    let shipMarkerCount: 1 | 2 | 3 = $state(1)
    let companyShipMarkerCount: 1 | 2 | 3 = $state(1)
    let shipMarkerPositions: Record<string, SeaShipLayout> = $state({})
    let shipMarkerPositionsLoaded = $state(false)
    let shipMarkerSelectedSeaId: string | null = $state(null)
    let shipMarkerSelectedIndex = $state(0)
    let shipMarkerDragging: { seaId: string; index: number } | null = $state(null)
    let shipMarkerCopyStatus: string | null = $state(null)
    let deedCardPositions: Record<string, { x: number; y: number }> = $state({})
    let deedCardPositionsLoaded = $state(false)
    let deedEra: Era = $state(Era.A)
    let selectedDeedCardKey: string | null = $state(null)
    let deedCardDraggingKey: string | null = $state(null)
    let deedCardCopyStatus: string | null = $state(null)

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

    type RegionLabel = {
        regionId: string
        x: number
        y: number
    }

    type ProductionMarkerType = 'spice' | 'siapsaji' | 'oil' | 'rice' | 'rubber'
    type ProductionMarkerPlacement = {
        areaId: string
        markerType: ProductionMarkerType | 'bead'
        x: number
        y: number
        beadTone?: BeadTone
    }

    type ShipSeaMarker = {
        id: string
        x: number
        y: number
        style: 'a' | 'b'
    }

    type ShipMarkerPoint = {
        x: number
        y: number
    }

    type SeaShipLayout = {
        1: ShipMarkerPoint[]
        2: ShipMarkerPoint[]
        3: ShipMarkerPoint[]
    }

    type ShipTuneMarker = {
        id: string
        seaId: string
        x: number
        y: number
        style: 'a' | 'b'
        index: number
    }

    type DeedCardKind = 'rice' | 'spice' | 'rubber' | 'oil' | 'ship'
    type ShippingSizeEntry = {
        era: Era
        size: number
    }

    type DeedTuneEntry = {
        positionKey: string
        regionId: string
        regionName: string
        cardKind: DeedCardKind
        shippingSizes: readonly ShippingSizeEntry[] | null
        x: number
        y: number
    }

    const DEBUG_PALETTE = ['#ff3b30', '#007aff', '#34c759', '#ffcc00', '#af52de', '#ff9500']
    const PRODUCTION_ICON_HEIGHT = 30
    const SHIP_MARKER_HEIGHT = 45
    const GLASS_BEAD_HEIGHT = 46
    const GLASS_BEAD_OPACITY = 0.85
    const DEED_CARD_HEIGHT = 58
    const DEED_CARD_BASE_OFFSET_X = 76
    const DEED_CARD_BASE_OFFSET_Y = -92
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
    const SHIP_MARKER_POSITIONS_STORAGE_KEY = 'indonesia-sea-ship-marker-positions-v1'
    const SEA_SHIP_MARKER_POSITION_LOOKUP = SEA_SHIP_MARKER_POSITIONS as Record<string, unknown>
    const LAND_MARKER_POSITION_LOOKUP = LAND_MARKER_POSITIONS as Record<
        string,
        { x: number; y: number }
    >
    const REGION_NAME_BY_ID = new Map(INDONESIA_REGIONS.map((region) => [region.id, region.name]))
    const SHIP_LAYOUT_OFFSETS: Record<1 | 2 | 3, Array<{ x: number; y: number }>> = {
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

    function pairKey(a: string, b: string): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`
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

    function getPathLabelPosition(path: string): { labelX: number; labelY: number } {
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
            labelX: (minX + maxX) / 2,
            labelY: (minY + maxY) / 2
        }
    }

    function toRoundedMarkerValue(value: number): number {
        return Math.round(value * 10) / 10
    }

    function deedPositionKey(regionId: string, deedType: CompanyType): string {
        return `${regionId}:${deedType}`
    }

    function parseDeedPositionKey(
        key: string
    ): {
        regionId: string
        deedType: CompanyType
    } | null {
        const [regionId, deedTypeRaw] = key.split(':')
        if (!regionId || !deedTypeRaw) {
            return null
        }
        if (deedTypeRaw !== CompanyType.Production && deedTypeRaw !== CompanyType.Shipping) {
            return null
        }
        return {
            regionId,
            deedType: deedTypeRaw
        }
    }

    function setDeedCardPosition(positionKey: string, x: number, y: number): void {
        deedCardPositions = {
            ...deedCardPositions,
            [positionKey]: {
                x: toRoundedMarkerValue(x),
                y: toRoundedMarkerValue(y)
            }
        }
    }

    function cloneShipLayout(layout: SeaShipLayout): SeaShipLayout {
        return {
            1: layout[1].map((point) => ({ ...point })),
            2: layout[2].map((point) => ({ ...point })),
            3: layout[3].map((point) => ({ ...point }))
        }
    }

    function getDefaultShipLayoutForArea(area: DebugArea): SeaShipLayout {
        const baseX = toRoundedMarkerValue(area.labelX)
        const baseY = toRoundedMarkerValue(area.labelY)
        const fallbackLayout: SeaShipLayout = {
            1: SHIP_LAYOUT_OFFSETS[1].map((offset) => ({
                x: toRoundedMarkerValue(baseX + offset.x),
                y: toRoundedMarkerValue(baseY + offset.y)
            })),
            2: SHIP_LAYOUT_OFFSETS[2].map((offset) => ({
                x: toRoundedMarkerValue(baseX + offset.x),
                y: toRoundedMarkerValue(baseY + offset.y)
            })),
            3: SHIP_LAYOUT_OFFSETS[3].map((offset) => ({
                x: toRoundedMarkerValue(baseX + offset.x),
                y: toRoundedMarkerValue(baseY + offset.y)
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
                    x: toRoundedMarkerValue(point.x),
                    y: toRoundedMarkerValue(point.y)
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

    function getSvgCoordinates(event: PointerEvent): { x: number; y: number } | null {
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
            x: toRoundedMarkerValue(transformed.x),
            y: toRoundedMarkerValue(transformed.y)
        }
    }

    function setMarkerPositionForArea(areaId: string, x: number, y: number): void {
        markerPositions = {
            ...markerPositions,
            [areaId]: {
                x: toRoundedMarkerValue(x),
                y: toRoundedMarkerValue(y)
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
            x: toRoundedMarkerValue(x),
            y: toRoundedMarkerValue(y)
        }
        shipMarkerPositions = {
            ...shipMarkerPositions,
            [seaId]: nextLayout
        }
    }

    function getDefaultMarkerPositionForArea(area: DebugArea): { x: number; y: number } {
        const defaultPosition = LAND_MARKER_POSITION_LOOKUP[area.id]
        if (defaultPosition) {
            return {
                x: toRoundedMarkerValue(defaultPosition.x),
                y: toRoundedMarkerValue(defaultPosition.y)
            }
        }
        return {
            x: toRoundedMarkerValue(area.labelX),
            y: toRoundedMarkerValue(area.labelY)
        }
    }

    function getMarkerPositionForArea(area: DebugArea): { x: number; y: number } {
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

    function stopMarkerDrag(): void {
        markerDraggingAreaId = null
        shipMarkerDragging = null
        deedCardDraggingKey = null
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

    function selectShipMarkerCount(nextCount: 1 | 2 | 3): void {
        shipMarkerCount = nextCount
        const maxMarkerIndex = nextCount - 1
        if (shipMarkerSelectedIndex > maxMarkerIndex) {
            shipMarkerSelectedIndex = maxMarkerIndex
        }
    }

    function selectCompanyShipMarkerCount(nextCount: 1 | 2 | 3): void {
        companyShipMarkerCount = nextCount
    }

    async function copyToClipboard(
        value: string,
        target: 'marker' | 'ship' | 'deed' = 'marker'
    ): Promise<void> {
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
            if (target === 'ship') {
                shipMarkerCopyStatus = 'Clipboard unavailable'
            } else if (target === 'deed') {
                deedCardCopyStatus = 'Clipboard unavailable'
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
            } else {
                markerCopyStatus = 'Copied'
            }
        } catch {
            if (target === 'ship') {
                shipMarkerCopyStatus = 'Copy failed'
            } else if (target === 'deed') {
                deedCardCopyStatus = 'Copy failed'
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
                const nextPositions: Record<string, { x: number; y: number }> = {}
                for (const [areaId, value] of Object.entries(parsed)) {
                    if (!value || typeof value !== 'object') {
                        continue
                    }
                    const candidate = value as { x?: unknown; y?: unknown }
                    if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') {
                        continue
                    }
                    nextPositions[areaId] = {
                        x: toRoundedMarkerValue(candidate.x),
                        y: toRoundedMarkerValue(candidate.y)
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
                const nextPositions: Record<string, { x: number; y: number }> = {}
                for (const [positionKey, value] of Object.entries(parsed)) {
                    if (!value || typeof value !== 'object') {
                        continue
                    }
                    const candidate = value as { x?: unknown; y?: unknown }
                    if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') {
                        continue
                    }
                    const parsedKey = parseDeedPositionKey(positionKey)
                    if (!parsedKey) {
                        continue
                    }
                    nextPositions[positionKey] = {
                        x: toRoundedMarkerValue(candidate.x),
                        y: toRoundedMarkerValue(candidate.y)
                    }
                }
                deedCardPositions = nextPositions
            }
        } catch {
            deedCardPositions = {}
        } finally {
            deedCardPositionsLoaded = true
        }
    })

    $effect(() => {
        if (!markerPositionsLoaded || typeof window === 'undefined') {
            return
        }
        window.localStorage.setItem(MARKER_POSITIONS_STORAGE_KEY, JSON.stringify(markerPositions))
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

            mappedAreas.push({
                id: node.id,
                path,
                label: node.id,
                region: node.region,
                ...getPathLabelPosition(path)
            })
        }

        return mappedAreas
    })

    const SEA_DEBUG_MAP_AREAS: DebugArea[] = $derived.by(() => {
        const areas = SEA_AREAS.map((area) => ({
            id: area.id,
            path: area.path,
            label: area.id,
            region: null,
            ...getPathLabelPosition(area.path)
        }))
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
        if (colorMode === 'marker') {
            return LAND_DEBUG_MAP_AREAS
        }
        return LAND_DEBUG_MAP_AREAS
    })

    const LAND_DEBUG_AREAS_BY_ID: Map<string, DebugArea> = $derived.by(
        () => new Map(LAND_DEBUG_MAP_AREAS.map((area) => [area.id, area]))
    )

    const REGION_CENTER_BY_ID_FOR_DEEDS: Map<string, { x: number; y: number }> = $derived.by(() => {
        const centers = new Map<string, { x: number; y: number }>()
        for (const region of INDONESIA_REGIONS) {
            const points: Array<{ x: number; y: number }> = []
            for (const areaId of region.areaIds) {
                const markerPoint = LAND_MARKER_POSITION_LOOKUP[areaId]
                if (markerPoint) {
                    points.push(markerPoint)
                    continue
                }
                const fallbackArea = LAND_DEBUG_AREAS_BY_ID.get(areaId)
                if (fallbackArea) {
                    points.push({ x: fallbackArea.labelX, y: fallbackArea.labelY })
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
            centers.set(region.id, {
                x: toRoundedMarkerValue(center.x / points.length),
                y: toRoundedMarkerValue(center.y / points.length)
            })
        }
        return centers
    })

    function getDefaultDeedCardPosition(regionId: string): { x: number; y: number } | null {
        const center = REGION_CENTER_BY_ID_FOR_DEEDS.get(regionId)
        if (!center) {
            return null
        }
        return {
            x: toRoundedMarkerValue(center.x + DEED_CARD_BASE_OFFSET_X),
            y: toRoundedMarkerValue(center.y + DEED_CARD_BASE_OFFSET_Y)
        }
    }

    function getDeedCardPosition(positionKey: string, regionId: string): { x: number; y: number } | null {
        const overridePosition = deedCardPositions[positionKey]
        if (overridePosition) {
            return {
                x: toRoundedMarkerValue(overridePosition.x),
                y: toRoundedMarkerValue(overridePosition.y)
            }
        }

        const baselinePosition = DEED_CARD_POSITIONS[positionKey]
        if (baselinePosition) {
            return {
                x: toRoundedMarkerValue(baselinePosition.x),
                y: toRoundedMarkerValue(baselinePosition.y)
            }
        }

        return getDefaultDeedCardPosition(regionId)
    }

    function getDeedCardKind(deed: AnyDeed): DeedCardKind {
        if (deed.type === CompanyType.Shipping) {
            return 'ship'
        }
        if (deed.good === Good.Rice) {
            return 'rice'
        }
        if (deed.good === Good.Rubber) {
            return 'rubber'
        }
        if (deed.good === Good.Oil) {
            return 'oil'
        }
        return 'spice'
    }

    function selectDeedEra(nextEra: Era): void {
        deedEra = nextEra
        selectedDeedCardKey = null
        deedCardDraggingKey = null
    }

    function shippingSizeEntriesFromDeed(deed: AnyDeed): readonly ShippingSizeEntry[] | null {
        if (deed.type !== CompanyType.Shipping) {
            return null
        }

        return [Era.A, Era.B, Era.C].flatMap((era) => {
            const size = deed.sizes[era]
            if (typeof size !== 'number') {
                return []
            }
            return [{ era, size }]
        })
    }

    const DEEDS_FOR_SELECTED_ERA: AnyDeed[] = $derived.by(() =>
        Deeds.filter((deed) => deed.era === deedEra)
    )

    const DEED_TUNE_ENTRIES: DeedTuneEntry[] = $derived.by(() => {
        const entries: DeedTuneEntry[] = []
        for (const deed of DEEDS_FOR_SELECTED_ERA) {
            const positionKey = deedPositionKey(deed.region, deed.type)
            const position = getDeedCardPosition(positionKey, deed.region)
            if (!position) {
                continue
            }
            entries.push({
                positionKey,
                regionId: deed.region,
                regionName: REGION_NAME_BY_ID.get(deed.region) ?? deed.region,
                cardKind: getDeedCardKind(deed),
                shippingSizes: shippingSizeEntriesFromDeed(deed),
                x: position.x,
                y: position.y
            })
        }
        return entries
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

    const DEED_CARD_OVERRIDES_EXPORT_TEXT: string = $derived.by(() => {
        const keys = Object.keys(deedCardPositions).sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
        )
        if (keys.length === 0) {
            return '// No deed card overrides yet.'
        }
        const lines = keys.map((positionKey) => {
            const point = deedCardPositions[positionKey]
            return `    '${positionKey}': { x: ${point.x.toFixed(1)}, y: ${point.y.toFixed(1)} },`
        })
        return `export const DEED_CARD_POSITIONS = {\n${lines.join('\n')}\n} as const`
    })

    const DEED_CARD_FULL_EXPORT_TEXT: string = $derived.by(() => {
        const keys = [...new Set(Deeds.map((deed) => deedPositionKey(deed.region, deed.type)))].sort(
            (left, right) => left.localeCompare(right, undefined, { numeric: true })
        )
        const lines: string[] = []
        for (const positionKey of keys) {
            const parsedKey = parseDeedPositionKey(positionKey)
            if (!parsedKey) {
                continue
            }
            const point = getDeedCardPosition(positionKey, parsedKey.regionId)
            if (!point) {
                continue
            }
            lines.push(
                `    '${positionKey}': { x: ${point.x.toFixed(1)}, y: ${point.y.toFixed(1)} },`
            )
        }
        return `export const DEED_CARD_POSITIONS = {\n${lines.join('\n')}\n} as const`
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

    const SELECTED_SHIP_SEA_AREA: DebugArea | null = $derived.by(() => {
        if (!shipMarkerSelectedSeaId) {
            return null
        }
        return SEA_DEBUG_AREAS_BY_ID.get(shipMarkerSelectedSeaId) ?? null
    })

    const SELECTED_SHIP_MARKER_POINT: ShipMarkerPoint | null = $derived.by(() => {
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

    function formatShipPoints(points: ShipMarkerPoint[]): string {
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
        resolvePosition: (area: DebugArea) => { x: number; y: number }
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
</script>

<div class="absolute inset-0 z-[2]">
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
            class:active={colorMode === 'marker'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'marker'
            }}
        >
            Markers
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
                {@const parsedSelectedKey = parseDeedPositionKey(SELECTED_DEED_TUNE_ENTRY.positionKey)}
                <div class="marker-tune-row">
                    <span>Region:</span>
                    <strong>{SELECTED_DEED_TUNE_ENTRY.regionId}</strong>
                    <span>Type:</span>
                    <strong>{parsedSelectedKey?.deedType ?? 'Unknown'}</strong>
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
                <CompanyCard type="rubber" x={200} y={680} height={58} text="Sumatera Barat" />
                <CompanyCard
                    type="rubber"
                    x={COMPANIES_RUBBER_CARD_A26_X}
                    y={COMPANIES_RUBBER_CARD_A26_Y}
                    height={58}
                    text="Riau"
                />
                <CompanyCard
                    type="rubber"
                    x={COMPANIES_RUBBER_CARD_B02_X}
                    y={COMPANIES_RUBBER_CARD_B02_Y}
                    height={58}
                    text="Kalimantan Barat"
                />
                <CompanyCard
                    type="spice"
                    x={COMPANIES_SPICE_CARD_C09_X}
                    y={COMPANIES_SPICE_CARD_C09_Y}
                    height={58}
                    text="Jawa Tengah"
                />
                <CompanyCard type="ship" x={COMPANIES_SHIP_CARD_A10_X} y={COMPANIES_SHIP_CARD_A10_Y} height={58} />
                <CompanyCard type="rice" x={45} y={250} height={58} text="Areh" />
            {/if}
            {#if colorMode === 'deeds'}
                {#each DEED_TUNE_ENTRIES as deed (deed.positionKey)}
                    <CompanyCard
                        type={deed.cardKind}
                        x={deed.x}
                        y={deed.y}
                        height={DEED_CARD_HEIGHT}
                        text={deed.regionName}
                        shippingSizes={deed.shippingSizes}
                    />
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
                {/each}
            {/if}
            {#if colorMode === 'ships'}
                {#each SHIP_TUNE_MARKERS as shipMarker (shipMarker.id)}
                    <ShipMarker
                        x={shipMarker.x}
                        y={shipMarker.y}
                        style={shipMarker.style}
                        height={SHIP_MARKER_HEIGHT}
                    />
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

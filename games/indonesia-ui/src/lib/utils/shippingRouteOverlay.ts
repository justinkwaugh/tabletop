import type { Point } from '@tabletop/common'
import { ALL_BOARD_AREAS, boardAreaPathById } from '$lib/definitions/boardGeometry.js'
import { SEA_SHIP_MARKER_POSITIONS } from '$lib/definitions/seaShipMarkerPositions.js'
import { resolveLandMarkerPosition } from '$lib/utils/boardMarkers.js'
import { getPathCenter } from '$lib/utils/geometry.js'

type DeliveryShippingRoutePathInput = {
    cultivatedAreaId: string
    cultivatedZoneAreaIds?: readonly string[]
    firstSeaWaypointOverride?: Point
    seaAreaIds: readonly string[]
    cityAreaId: string
}

type GridCell = {
    x: number
    y: number
}

type OpenNode = {
    key: number
    score: number
}

type LandShape = {
    areaId: string
    path: SVGPathElement
    bbox: {
        left: number
        right: number
        top: number
        bottom: number
    }
}

type RoutingContext = {
    allowedLandAreaIds: ReadonlySet<string>
    cacheKey: string
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const BOARD_WIDTH = 2646
const BOARD_HEIGHT = 1280
const LAND_INFLATION_PIXELS = 15
const GRID_STEP = 12
const GRID_COLS = Math.floor(BOARD_WIDTH / GRID_STEP) + 1
const GRID_ROWS = Math.floor(BOARD_HEIGHT / GRID_STEP) + 1
const MAX_SEARCH_STEPS = 200_000
const SEGMENT_SAMPLE_STEP = 6
const CURVE_CORNER_MAX_RADIUS = 14
const CURVE_CORNER_RATIO = 0.34

const EIGHT_WAY_NEIGHBORS = [
    { dx: -1, dy: -1, cost: Math.SQRT2 },
    { dx: 0, dy: -1, cost: 1 },
    { dx: 1, dy: -1, cost: Math.SQRT2 },
    { dx: -1, dy: 0, cost: 1 },
    { dx: 1, dy: 0, cost: 1 },
    { dx: -1, dy: 1, cost: Math.SQRT2 },
    { dx: 0, dy: 1, cost: 1 },
    { dx: 1, dy: 1, cost: Math.SQRT2 }
]

let hiddenSvgRoot: SVGSVGElement | null = null
let cachedLandShapes: readonly LandShape[] | null = null
const blockedCellByKey = new Map<string, boolean>()
const waterPathByCellPairKey = new Map<string, Point[]>()

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

function formatCoordinate(value: number): string {
    return value.toFixed(1)
}

function pointDistance(a: Point, b: Point): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.hypot(dx, dy)
}

function resolveFirstSeaWaypoint(input: DeliveryShippingRoutePathInput): Point | null {
    if (input.firstSeaWaypointOverride) {
        return input.firstSeaWaypointOverride
    }

    const firstSeaAreaId = input.seaAreaIds[0]
    if (!firstSeaAreaId) {
        return null
    }

    return seaWaypointForAreaId(firstSeaAreaId)
}

function resolveRouteSourceCultivatedAreaId(input: DeliveryShippingRoutePathInput): string {
    const firstSeaPoint = resolveFirstSeaWaypoint(input)
    if (!firstSeaPoint) {
        return input.cultivatedAreaId
    }

    const zoneAreaIds = input.cultivatedZoneAreaIds
    if (!zoneAreaIds || zoneAreaIds.length === 0) {
        return input.cultivatedAreaId
    }

    let nearestAreaId = input.cultivatedAreaId
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const areaId of zoneAreaIds) {
        const areaPoint = resolveLandMarkerPosition(areaId)
        if (!areaPoint) {
            continue
        }

        const distance = pointDistance(areaPoint, firstSeaPoint)
        if (distance < nearestDistance) {
            nearestDistance = distance
            nearestAreaId = areaId
        }
    }

    return nearestAreaId
}

function pointsAreNear(a: Point, b: Point, epsilon = 0.5): boolean {
    return pointDistance(a, b) <= epsilon
}

function appendPointIfNeeded(points: Point[], point: Point): void {
    const lastPoint = points.at(-1)
    if (lastPoint && pointsAreNear(lastPoint, point)) {
        return
    }

    points.push(point)
}

function pointToCell(point: Point): GridCell {
    return {
        x: clamp(Math.round(point.x / GRID_STEP), 0, GRID_COLS - 1),
        y: clamp(Math.round(point.y / GRID_STEP), 0, GRID_ROWS - 1)
    }
}

function cellToPoint(cell: GridCell): Point {
    return {
        x: cell.x * GRID_STEP,
        y: cell.y * GRID_STEP
    }
}

function cellToKey(cell: GridCell): number {
    return cell.y * GRID_COLS + cell.x
}

function keyToCell(key: number): GridCell {
    return {
        x: key % GRID_COLS,
        y: Math.floor(key / GRID_COLS)
    }
}

function pointLerp(a: Point, b: Point, t: number): Point {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    }
}

function pointToward(from: Point, to: Point, distance: number): Point {
    const segmentLength = pointDistance(from, to)
    if (segmentLength <= 0 || distance <= 0) {
        return from
    }

    const t = clamp(distance / segmentLength, 0, 1)
    return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t
    }
}

function createRoutingContext(allowedLandAreaIds: readonly string[]): RoutingContext {
    const sortedAllowedAreaIds = [...allowedLandAreaIds].sort((a, b) => a.localeCompare(b))
    return {
        allowedLandAreaIds: new Set(sortedAllowedAreaIds),
        cacheKey: sortedAllowedAreaIds.join('|')
    }
}

function ensureHiddenSvgRoot(): SVGSVGElement | null {
    if (typeof document === 'undefined') {
        return null
    }

    if (hiddenSvgRoot) {
        return hiddenSvgRoot
    }

    const root = document.createElementNS(SVG_NAMESPACE, 'svg')
    root.setAttribute('width', '0')
    root.setAttribute('height', '0')
    root.setAttribute('viewBox', '0 0 0 0')
    root.setAttribute('aria-hidden', 'true')
    root.style.position = 'absolute'
    root.style.width = '0'
    root.style.height = '0'
    root.style.opacity = '0'
    root.style.overflow = 'hidden'
    root.style.pointerEvents = 'none'
    root.style.left = '-99999px'
    root.style.top = '-99999px'
    document.body.appendChild(root)
    hiddenSvgRoot = root
    return root
}

function ensureLandShapes(): readonly LandShape[] {
    if (cachedLandShapes) {
        return cachedLandShapes
    }

    const root = ensureHiddenSvgRoot()
    if (!root) {
        cachedLandShapes = []
        return cachedLandShapes
    }

    const shapes: LandShape[] = []
    for (const area of ALL_BOARD_AREAS) {
        if (area.id.startsWith('S')) {
            continue
        }

        const path = document.createElementNS(SVG_NAMESPACE, 'path')
        path.setAttribute('d', area.path)
        path.setAttribute('fill', '#000')
        path.setAttribute('stroke', '#000')
        path.setAttribute('stroke-width', `${LAND_INFLATION_PIXELS * 2}`)
        path.setAttribute('stroke-linejoin', 'round')
        root.appendChild(path)

        const bbox = path.getBBox()
        shapes.push({
            areaId: area.id,
            path,
            bbox: {
                left: bbox.x - LAND_INFLATION_PIXELS,
                right: bbox.x + bbox.width + LAND_INFLATION_PIXELS,
                top: bbox.y - LAND_INFLATION_PIXELS,
                bottom: bbox.y + bbox.height + LAND_INFLATION_PIXELS
            }
        })
    }

    cachedLandShapes = shapes
    return cachedLandShapes
}

function pointInLand(point: Point, routingContext: RoutingContext): boolean {
    const landShapes = ensureLandShapes()
    if (landShapes.length === 0 || typeof DOMPoint === 'undefined') {
        return false
    }

    const domPoint = new DOMPoint(point.x, point.y)
    for (const shape of landShapes) {
        if (routingContext.allowedLandAreaIds.has(shape.areaId)) {
            continue
        }

        if (
            point.x < shape.bbox.left ||
            point.x > shape.bbox.right ||
            point.y < shape.bbox.top ||
            point.y > shape.bbox.bottom
        ) {
            continue
        }

        if (shape.path.isPointInFill(domPoint) || shape.path.isPointInStroke(domPoint)) {
            return true
        }
    }

    return false
}

function isWaterCell(cell: GridCell, routingContext: RoutingContext): boolean {
    if (cell.x < 0 || cell.x >= GRID_COLS || cell.y < 0 || cell.y >= GRID_ROWS) {
        return false
    }

    const key = `${routingContext.cacheKey}:${cellToKey(cell)}`
    const cachedBlocked = blockedCellByKey.get(key)
    if (cachedBlocked !== undefined) {
        return !cachedBlocked
    }

    const blocked = pointInLand(cellToPoint(cell), routingContext)
    blockedCellByKey.set(key, blocked)
    return !blocked
}

function nearestWaterCell(
    cell: GridCell,
    routingContext: RoutingContext,
    maxRadius = 10
): GridCell | null {
    if (isWaterCell(cell, routingContext)) {
        return cell
    }

    for (let radius = 1; radius <= maxRadius; radius += 1) {
        let found: GridCell | null = null
        let bestDistance = Number.POSITIVE_INFINITY

        for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
                    continue
                }

                const candidate: GridCell = {
                    x: cell.x + dx,
                    y: cell.y + dy
                }
                if (!isWaterCell(candidate, routingContext)) {
                    continue
                }

                const distance = Math.hypot(dx, dy)
                if (distance < bestDistance) {
                    bestDistance = distance
                    found = candidate
                }
            }
        }

        if (found) {
            return found
        }
    }

    return null
}

function heuristicDistance(a: GridCell, b: GridCell): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

function reconstructPath(goalKey: number, parentByKey: ReadonlyMap<number, number>): GridCell[] {
    const path: GridCell[] = []
    let cursor: number | undefined = goalKey
    while (cursor !== undefined) {
        path.push(keyToCell(cursor))
        cursor = parentByKey.get(cursor)
    }
    return path.reverse()
}

function popLowestScoreNode(openNodes: OpenNode[]): OpenNode | null {
    if (openNodes.length === 0) {
        return null
    }

    let minIndex = 0
    for (let index = 1; index < openNodes.length; index += 1) {
        if (openNodes[index].score < openNodes[minIndex].score) {
            minIndex = index
        }
    }

    const [node] = openNodes.splice(minIndex, 1)
    return node ?? null
}

function findWaterGridPath(
    start: Point,
    end: Point,
    routingContext: RoutingContext
): Point[] | null {
    const startCell = nearestWaterCell(pointToCell(start), routingContext)
    const endCell = nearestWaterCell(pointToCell(end), routingContext)
    if (!startCell || !endCell) {
        return null
    }

    const startKey = cellToKey(startCell)
    const endKey = cellToKey(endCell)

    const openNodes: OpenNode[] = [
        {
            key: startKey,
            score: heuristicDistance(startCell, endCell)
        }
    ]
    const gScoreByKey = new Map<number, number>([[startKey, 0]])
    const parentByKey = new Map<number, number>()

    let iterations = 0
    while (openNodes.length > 0 && iterations < MAX_SEARCH_STEPS) {
        iterations += 1
        const node = popLowestScoreNode(openNodes)
        if (!node) {
            break
        }

        if (node.key === endKey) {
            return reconstructPath(endKey, parentByKey).map(cellToPoint)
        }

        const currentCell = keyToCell(node.key)
        const currentGScore = gScoreByKey.get(node.key)
        if (currentGScore === undefined) {
            continue
        }

        for (const neighborOffset of EIGHT_WAY_NEIGHBORS) {
            const neighborCell: GridCell = {
                x: currentCell.x + neighborOffset.dx,
                y: currentCell.y + neighborOffset.dy
            }
            if (!isWaterCell(neighborCell, routingContext)) {
                continue
            }

            const neighborKey = cellToKey(neighborCell)
            const nextGScore = currentGScore + neighborOffset.cost
            const existingGScore = gScoreByKey.get(neighborKey)
            if (existingGScore !== undefined && nextGScore >= existingGScore) {
                continue
            }

            parentByKey.set(neighborKey, node.key)
            gScoreByKey.set(neighborKey, nextGScore)
            const nextScore = nextGScore + heuristicDistance(neighborCell, endCell)
            openNodes.push({
                key: neighborKey,
                score: nextScore
            })
        }
    }

    return null
}

function segmentStaysOnWater(start: Point, end: Point, routingContext: RoutingContext): boolean {
    const segmentLength = pointDistance(start, end)
    if (segmentLength <= 0) {
        return !pointInLand(start, routingContext)
    }

    const sampleCount = Math.max(1, Math.ceil(segmentLength / SEGMENT_SAMPLE_STEP))
    for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
        const samplePoint = pointLerp(start, end, sampleIndex / sampleCount)
        if (pointInLand(samplePoint, routingContext)) {
            return false
        }
    }

    return true
}

function simplifyWaterPath(points: readonly Point[], routingContext: RoutingContext): Point[] {
    if (points.length <= 2) {
        return [...points]
    }

    const simplified: Point[] = [points[0]]
    let anchorIndex = 0
    while (anchorIndex < points.length - 1) {
        let nextIndex = points.length - 1
        while (nextIndex > anchorIndex + 1) {
            if (segmentStaysOnWater(points[anchorIndex], points[nextIndex], routingContext)) {
                break
            }
            nextIndex -= 1
        }

        simplified.push(points[nextIndex])
        anchorIndex = nextIndex
    }

    return simplified
}

function routeThroughWater(
    start: Point,
    end: Point,
    routingContext: RoutingContext
): Point[] | null {
    if (typeof document === 'undefined' || cachedLandShapes?.length === 0) {
        return [start, end]
    }

    if (segmentStaysOnWater(start, end, routingContext)) {
        return [start, end]
    }

    const startCell = pointToCell(start)
    const endCell = pointToCell(end)
    const forwardKey = `${routingContext.cacheKey}:${startCell.x},${startCell.y}->${endCell.x},${endCell.y}`
    const cachedForward = waterPathByCellPairKey.get(forwardKey)
    if (cachedForward) {
        return cachedForward
    }

    const reverseKey = `${routingContext.cacheKey}:${endCell.x},${endCell.y}->${startCell.x},${startCell.y}`
    const cachedReverse = waterPathByCellPairKey.get(reverseKey)
    if (cachedReverse) {
        return [...cachedReverse].reverse()
    }

    const routedPath = findWaterGridPath(start, end, routingContext)
    if (!routedPath || routedPath.length === 0) {
        return null
    }

    const withExactEndpoints = [...routedPath]
    withExactEndpoints[0] = start
    withExactEndpoints[withExactEndpoints.length - 1] = end

    const simplifiedPath = simplifyWaterPath(withExactEndpoints, routingContext)
    waterPathByCellPairKey.set(forwardKey, simplifiedPath)
    waterPathByCellPairKey.set(reverseKey, [...simplifiedPath].reverse())
    return simplifiedPath
}

function firstWaterPointAlongLine(
    landPoint: Point,
    towardPoint: Point,
    routingContext: RoutingContext
): Point | null {
    const samples = 96
    for (let sampleIndex = 0; sampleIndex <= samples; sampleIndex += 1) {
        const point = pointLerp(landPoint, towardPoint, sampleIndex / samples)
        if (!pointInLand(point, routingContext)) {
            return point
        }
    }

    return null
}

function seaWaypointForAreaId(seaAreaId: string): Point | null {
    const layout = SEA_SHIP_MARKER_POSITIONS[seaAreaId]
    if (layout?.[1]?.[0]) {
        return layout[1][0]
    }

    const areaPath = boardAreaPathById(seaAreaId)
    if (!areaPath) {
        return null
    }

    return getPathCenter(areaPath)
}

function pointsToSvgPath(points: readonly Point[]): string | null {
    if (points.length === 0) {
        return null
    }

    if (points.length === 1) {
        return `M ${formatCoordinate(points[0].x)} ${formatCoordinate(points[0].y)}`
    }

    const pathCommands: string[] = [`M ${formatCoordinate(points[0].x)} ${formatCoordinate(points[0].y)}`]
    let currentPoint = points[0]

    for (let index = 1; index < points.length - 1; index += 1) {
        const previous = points[index - 1]
        const corner = points[index]
        const next = points[index + 1]

        const incomingLength = pointDistance(previous, corner)
        const outgoingLength = pointDistance(corner, next)
        if (incomingLength <= 0 || outgoingLength <= 0) {
            if (!pointsAreNear(currentPoint, corner)) {
                pathCommands.push(`L ${formatCoordinate(corner.x)} ${formatCoordinate(corner.y)}`)
                currentPoint = corner
            }
            continue
        }

        const cornerRadius = Math.min(
            CURVE_CORNER_MAX_RADIUS,
            incomingLength * CURVE_CORNER_RATIO,
            outgoingLength * CURVE_CORNER_RATIO
        )
        if (cornerRadius <= 0) {
            if (!pointsAreNear(currentPoint, corner)) {
                pathCommands.push(`L ${formatCoordinate(corner.x)} ${formatCoordinate(corner.y)}`)
                currentPoint = corner
            }
            continue
        }

        const entryPoint = pointToward(corner, previous, cornerRadius)
        const exitPoint = pointToward(corner, next, cornerRadius)

        if (!pointsAreNear(currentPoint, entryPoint)) {
            pathCommands.push(`L ${formatCoordinate(entryPoint.x)} ${formatCoordinate(entryPoint.y)}`)
        }

        pathCommands.push(
            `Q ${formatCoordinate(corner.x)} ${formatCoordinate(corner.y)} ${formatCoordinate(exitPoint.x)} ${formatCoordinate(exitPoint.y)}`
        )
        currentPoint = exitPoint
    }

    const lastPoint = points[points.length - 1]
    if (!pointsAreNear(currentPoint, lastPoint)) {
        pathCommands.push(`L ${formatCoordinate(lastPoint.x)} ${formatCoordinate(lastPoint.y)}`)
    }

    return pathCommands.join(' ')
}

function appendPathSegment(target: Point[], segment: readonly Point[]): void {
    for (const point of segment) {
        appendPointIfNeeded(target, point)
    }
}

function buildStraightFallbackPath(input: DeliveryShippingRoutePathInput): string | null {
    if (input.seaAreaIds.length === 0) {
        return null
    }

    const points: Point[] = []
    const sourceCultivatedAreaId = resolveRouteSourceCultivatedAreaId(input)
    const cultivatedPoint = resolveLandMarkerPosition(sourceCultivatedAreaId)
    if (cultivatedPoint) {
        points.push(cultivatedPoint)
    }

    for (const [seaAreaIndex, seaAreaId] of input.seaAreaIds.entries()) {
        const seaPoint =
            seaAreaIndex === 0 ? resolveFirstSeaWaypoint(input) : seaWaypointForAreaId(seaAreaId)
        if (!seaPoint) {
            return null
        }
        appendPointIfNeeded(points, seaPoint)
    }

    const cityPoint = resolveLandMarkerPosition(input.cityAreaId)
    if (cityPoint) {
        appendPointIfNeeded(points, cityPoint)
    }

    return pointsToSvgPath(points)
}

export function buildDeliveryShippingRoutePath(input: DeliveryShippingRoutePathInput): string | null {
    if (input.seaAreaIds.length === 0) {
        return null
    }

    const seaWaypoints: Point[] = []
    for (const [seaAreaIndex, seaAreaId] of input.seaAreaIds.entries()) {
        const seaWaypoint =
            seaAreaIndex === 0 ? resolveFirstSeaWaypoint(input) : seaWaypointForAreaId(seaAreaId)
        if (!seaWaypoint) {
            return null
        }
        seaWaypoints.push(seaWaypoint)
    }

    const landShapes = ensureLandShapes()
    if (landShapes.length === 0) {
        return buildStraightFallbackPath(input)
    }

    const sourceCultivatedAreaId = resolveRouteSourceCultivatedAreaId(input)
    const sourceRoutingContext = createRoutingContext([sourceCultivatedAreaId])
    const seaRoutingContext = createRoutingContext([])
    const targetRoutingContext = createRoutingContext([input.cityAreaId])

    const fullRoutePoints: Point[] = []

    const cultivatedPoint = resolveLandMarkerPosition(sourceCultivatedAreaId)
    const firstSeaPoint = seaWaypoints[0]
    if (cultivatedPoint) {
        appendPointIfNeeded(fullRoutePoints, cultivatedPoint)
        const startWaterPoint = firstWaterPointAlongLine(
            cultivatedPoint,
            firstSeaPoint,
            sourceRoutingContext
        )
        if (!startWaterPoint) {
            return null
        }
        const startSegment = routeThroughWater(
            startWaterPoint,
            firstSeaPoint,
            sourceRoutingContext
        )
        if (!startSegment) {
            return null
        }
        appendPathSegment(fullRoutePoints, startSegment)
    } else {
        appendPointIfNeeded(fullRoutePoints, firstSeaPoint)
    }

    for (let index = 1; index < seaWaypoints.length; index += 1) {
        const from = seaWaypoints[index - 1]
        const to = seaWaypoints[index]
        const seaSegment = routeThroughWater(from, to, seaRoutingContext)
        if (!seaSegment) {
            return null
        }
        appendPathSegment(fullRoutePoints, seaSegment)
    }

    const cityPoint = resolveLandMarkerPosition(input.cityAreaId)
    const lastSeaPoint = seaWaypoints[seaWaypoints.length - 1]
    if (cityPoint) {
        const cityWaterPoint = firstWaterPointAlongLine(cityPoint, lastSeaPoint, targetRoutingContext)
        if (!cityWaterPoint) {
            return null
        }
        const endSegment = routeThroughWater(lastSeaPoint, cityWaterPoint, targetRoutingContext)
        if (!endSegment) {
            return null
        }
        appendPathSegment(fullRoutePoints, endSegment)
        appendPointIfNeeded(fullRoutePoints, cityPoint)
    }

    return pointsToSvgPath(fullRoutePoints)
}

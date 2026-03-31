import type { Point } from '@tabletop/common'
import { boardAreaPathById } from '$lib/definitions/boardGeometry.js'
import { resolveLandMarkerPosition } from '$lib/utils/boardMarkers.js'

type BoundaryProfile = {
    pathElement: SVGPathElement
    totalLength: number
    sampleLengths: number[]
    samplePoints: Point[]
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const BOUNDARY_SAMPLE_SPACING = 12
const BOUNDARY_REFINE_ITERATIONS = 8
const BOUNDARY_CACHE_DECIMALS = 1
const MAX_BOUNDARY_POINT_CACHE_ENTRIES = 4000
const MAX_ZONE_BOUNDARY_TARGET_CACHE_ENTRIES = 2500

let hiddenSvgRoot: SVGSVGElement | null = null
const boundaryProfileByAreaId = new Map<string, BoundaryProfile>()
const boundaryPointCache = new Map<string, Point | null>()
const zoneBoundaryTargetCache = new Map<string, Point>()

function roundToCachePrecision(value: number): number {
    const scale = 10 ** BOUNDARY_CACHE_DECIMALS
    return Math.round(value * scale) / scale
}

function boundaryPointCacheKey(areaId: string, point: Point): string {
    return `${areaId}|${roundToCachePrecision(point.x)}|${roundToCachePrecision(point.y)}`
}

function zoneBoundaryTargetCacheKey(markerPoint: Point, zoneAreaIds: readonly string[]): string {
    return `${roundToCachePrecision(markerPoint.x)}|${roundToCachePrecision(markerPoint.y)}|${zoneAreaIds.join(',')}`
}

function pointDistance(a: Point, b: Point): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.hypot(dx, dy)
}

function setBoundedMapValue<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number): void {
    map.set(key, value)
    if (map.size > maxEntries) {
        const oldestKey = map.keys().next().value as K | undefined
        if (oldestKey !== undefined) {
            map.delete(oldestKey)
        }
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

function ensureBoundaryProfileForArea(areaId: string): BoundaryProfile | null {
    const cached = boundaryProfileByAreaId.get(areaId)
    if (cached) {
        return cached
    }

    const root = ensureHiddenSvgRoot()
    if (!root) {
        return null
    }

    const areaPath = boardAreaPathById(areaId)
    if (!areaPath) {
        return null
    }

    const pathElement = document.createElementNS(SVG_NAMESPACE, 'path')
    pathElement.setAttribute('d', areaPath)
    root.appendChild(pathElement)

    const totalLength = pathElement.getTotalLength()
    if (!Number.isFinite(totalLength) || totalLength <= 0) {
        pathElement.remove()
        return null
    }

    const sampleCount = Math.max(8, Math.ceil(totalLength / BOUNDARY_SAMPLE_SPACING))
    const sampleLengths: number[] = []
    const samplePoints: Point[] = []
    for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
        const sampleLength = (totalLength * sampleIndex) / sampleCount
        const samplePoint = pathElement.getPointAtLength(sampleLength)
        sampleLengths.push(sampleLength)
        samplePoints.push({
            x: samplePoint.x,
            y: samplePoint.y
        })
    }

    const profile: BoundaryProfile = {
        pathElement,
        totalLength,
        sampleLengths,
        samplePoints
    }
    boundaryProfileByAreaId.set(areaId, profile)
    return profile
}

function nearestPointOnAreaBoundary(areaId: string, point: Point): Point | null {
    const cacheKey = boundaryPointCacheKey(areaId, point)
    const cachedPoint = boundaryPointCache.get(cacheKey)
    if (cachedPoint !== undefined) {
        return cachedPoint
    }

    const profile = ensureBoundaryProfileForArea(areaId)
    if (!profile) {
        setBoundedMapValue(boundaryPointCache, cacheKey, null, MAX_BOUNDARY_POINT_CACHE_ENTRIES)
        return null
    }

    const { pathElement, totalLength, sampleLengths, samplePoints } = profile
    if (samplePoints.length === 0) {
        setBoundedMapValue(boundaryPointCache, cacheKey, null, MAX_BOUNDARY_POINT_CACHE_ENTRIES)
        return null
    }

    let bestIndex = 0
    let bestPoint = samplePoints[0] as Point
    let bestDistance = pointDistance(point, bestPoint)
    let bestLength = sampleLengths[0] ?? 0
    for (let sampleIndex = 1; sampleIndex < samplePoints.length; sampleIndex += 1) {
        const samplePoint = samplePoints[sampleIndex] as Point
        const distance = pointDistance(point, samplePoint)
        if (distance < bestDistance) {
            bestDistance = distance
            bestIndex = sampleIndex
            bestPoint = samplePoint
            bestLength = sampleLengths[sampleIndex] ?? bestLength
        }
    }

    const leftNeighborLength = sampleLengths[Math.max(0, bestIndex - 1)] ?? bestLength
    const rightNeighborLength =
        sampleLengths[Math.min(sampleLengths.length - 1, bestIndex + 1)] ?? bestLength
    let leftLength = Math.max(0, Math.min(leftNeighborLength, bestLength))
    let rightLength = Math.min(totalLength, Math.max(rightNeighborLength, bestLength))
    if (rightLength <= leftLength) {
        const sampleSpan = totalLength / Math.max(1, samplePoints.length - 1)
        leftLength = Math.max(0, bestLength - sampleSpan)
        rightLength = Math.min(totalLength, bestLength + sampleSpan)
    }

    for (let iteration = 0; iteration < BOUNDARY_REFINE_ITERATIONS; iteration += 1) {
        const span = rightLength - leftLength
        if (span < 0.0001) {
            break
        }

        const leftThirdLength = leftLength + span / 3
        const rightThirdLength = rightLength - span / 3
        const leftThirdPoint = pathElement.getPointAtLength(leftThirdLength)
        const rightThirdPoint = pathElement.getPointAtLength(rightThirdLength)
        const leftThirdDistance = pointDistance(point, { x: leftThirdPoint.x, y: leftThirdPoint.y })
        const rightThirdDistance = pointDistance(point, {
            x: rightThirdPoint.x,
            y: rightThirdPoint.y
        })

        if (leftThirdDistance <= rightThirdDistance) {
            rightLength = rightThirdLength
            if (leftThirdDistance < bestDistance) {
                bestDistance = leftThirdDistance
                bestLength = leftThirdLength
                bestPoint = { x: leftThirdPoint.x, y: leftThirdPoint.y }
            }
        } else {
            leftLength = leftThirdLength
            if (rightThirdDistance < bestDistance) {
                bestDistance = rightThirdDistance
                bestLength = rightThirdLength
                bestPoint = { x: rightThirdPoint.x, y: rightThirdPoint.y }
            }
        }
    }

    const refinedPoint = pathElement.getPointAtLength(bestLength)
    const refinedDistance = pointDistance(point, { x: refinedPoint.x, y: refinedPoint.y })
    const resolvedPoint =
        refinedDistance < bestDistance
            ? {
                  x: refinedPoint.x,
                  y: refinedPoint.y
              }
            : {
                  x: bestPoint.x,
                  y: bestPoint.y
              }
    setBoundedMapValue(
        boundaryPointCache,
        cacheKey,
        resolvedPoint,
        MAX_BOUNDARY_POINT_CACHE_ENTRIES
    )
    return resolvedPoint
}

export function resolveProductionZoneBoundaryTarget(
    markerPoint: Point,
    zoneAreaIds: readonly string[],
    fallbackTarget: Point
): Point {
    if (zoneAreaIds.length === 0) {
        return fallbackTarget
    }

    const cacheKey = zoneBoundaryTargetCacheKey(markerPoint, zoneAreaIds)
    const cachedBoundaryTarget = zoneBoundaryTargetCache.get(cacheKey)
    if (cachedBoundaryTarget) {
        return cachedBoundaryTarget
    }

    let nearestPoint: Point | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    const orderedAreaIds = [...zoneAreaIds].sort((leftAreaId, rightAreaId) => {
        const leftCenter = resolveLandMarkerPosition(leftAreaId)
        const rightCenter = resolveLandMarkerPosition(rightAreaId)
        const leftDistance = leftCenter ? pointDistance(markerPoint, leftCenter) : Number.POSITIVE_INFINITY
        const rightDistance = rightCenter ? pointDistance(markerPoint, rightCenter) : Number.POSITIVE_INFINITY
        if (leftDistance !== rightDistance) {
            return leftDistance - rightDistance
        }
        return leftAreaId.localeCompare(rightAreaId, undefined, { numeric: true })
    })

    for (const areaId of orderedAreaIds) {
        const boundaryPoint = nearestPointOnAreaBoundary(areaId, markerPoint)
        if (!boundaryPoint) {
            continue
        }

        const distance = pointDistance(markerPoint, boundaryPoint)
        if (distance < nearestDistance) {
            nearestDistance = distance
            nearestPoint = boundaryPoint
        }
    }

    const resolvedTarget = nearestPoint ?? fallbackTarget
    setBoundedMapValue(
        zoneBoundaryTargetCache,
        cacheKey,
        resolvedTarget,
        MAX_ZONE_BOUNDARY_TARGET_CACHE_ENTRIES
    )
    return resolvedTarget
}

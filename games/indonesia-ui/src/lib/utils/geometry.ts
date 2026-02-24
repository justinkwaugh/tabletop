import type { Point } from '@tabletop/common'

export function roundToTenth(value: number): number {
    return Math.round(value * 10) / 10
}

export function getPathCenter(path: string): Point {
    const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    if (values.length < 2) {
        return { x: 0, y: 0 }
    }

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

export function buildAreaCenterById(
    regionAreaIds: Iterable<readonly string[]>,
    areaPathById: ReadonlyMap<string, string>
): Map<string, Point> {
    const centers = new Map<string, Point>()
    for (const areaIds of regionAreaIds) {
        for (const areaId of areaIds) {
            if (centers.has(areaId)) {
                continue
            }
            const areaPath = areaPathById.get(areaId)
            if (!areaPath) {
                continue
            }
            centers.set(areaId, getPathCenter(areaPath))
        }
    }
    return centers
}

export function buildRegionCenterById(
    regionAreaIdsById: Iterable<[string, readonly string[]]>,
    markerPositionByAreaId: Readonly<Record<string, Point>>,
    areaCenterById: ReadonlyMap<string, Point>
): Map<string, Point> {
    const centers = new Map<string, Point>()

    for (const [regionId, areaIds] of regionAreaIdsById) {
        const points: Point[] = []
        for (const areaId of areaIds) {
            const markerPoint = markerPositionByAreaId[areaId]
            if (markerPoint) {
                points.push(markerPoint)
                continue
            }

            const fallbackPoint = areaCenterById.get(areaId)
            if (fallbackPoint) {
                points.push(fallbackPoint)
            }
        }

        if (points.length === 0) {
            continue
        }

        const total = points.reduce(
            (acc, point) => {
                acc.x += point.x
                acc.y += point.y
                return acc
            },
            { x: 0, y: 0 }
        )

        centers.set(regionId, {
            x: roundToTenth(total.x / points.length),
            y: roundToTenth(total.y / points.length)
        })
    }

    return centers
}

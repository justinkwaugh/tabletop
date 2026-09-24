import type { Point } from '@tabletop/common'

export type TileDrawnPath = {
    id: string
    start: Point
    end: Point
    controls: readonly [Point, Point]
    arc?: { center: Point; radius: number; sweep: number }
    d: string
}

export function createStraightTilePath(id: string, start: Point, end: Point): TileDrawnPath {
    return {
        id,
        start,
        end,
        controls: [start, end],
        d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`
    }
}

export function createCubicTilePath(
    id: string,
    start: Point,
    end: Point,
    controls: readonly [Point, Point]
): TileDrawnPath {
    return {
        id,
        start,
        end,
        controls,
        d: `M ${start.x} ${start.y} C ${controls[0].x} ${controls[0].y} ${controls[1].x} ${controls[1].y} ${end.x} ${end.y}`
    }
}

export function createEdgeTilePath(id: string, start: Point, end: Point): TileDrawnPath {
    const determinant = start.x * end.y - start.y * end.x
    if (Math.abs(determinant) < 0.001) return createStraightTilePath(id, start, end)
    const startSquared = start.x ** 2 + start.y ** 2
    const endSquared = end.x ** 2 + end.y ** 2
    const center = {
        x: (startSquared * end.y - endSquared * start.y) / determinant,
        y: (start.x * endSquared - end.x * startSquared) / determinant
    }
    return createArcTilePath(id, start, end, center)
}

export function createArcTilePath(
    id: string,
    start: Point,
    end: Point,
    center: Point
): TileDrawnPath {
    const a = { x: start.x - center.x, y: start.y - center.y }
    const b = { x: end.x - center.x, y: end.y - center.y }
    const radius = Math.hypot(a.x, a.y)
    const sweep = Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)
    const handle = (4 / 3) * Math.tan(sweep / 4)
    return {
        id,
        start,
        end,
        controls: [
            { x: start.x - a.y * handle, y: start.y + a.x * handle },
            { x: end.x + b.y * handle, y: end.y - b.x * handle }
        ],
        arc: { center, radius, sweep },
        d: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep > 0 ? 1 : 0} ${end.x} ${end.y}`
    }
}

export function tilePathPoint(path: TileDrawnPath, t: number): Point {
    if (path.arc) {
        const { center, radius, sweep } = path.arc
        const angle = Math.atan2(path.start.y - center.y, path.start.x - center.x) + sweep * t
        return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
    }
    const weights = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3]
    return [path.start, ...path.controls, path.end].reduce(
        (point, control, i) => ({
            x: point.x + control.x * weights[i],
            y: point.y + control.y * weights[i]
        }),
        { x: 0, y: 0 }
    )
}

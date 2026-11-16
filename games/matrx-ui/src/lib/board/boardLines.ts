import { addAxial, scaleAxial, type Point } from '@tabletop/common'
import { AXES, CENTRE } from '@tabletop/matrx'
import { SPACING, type BoardView, type Frame } from './geometry.js'

export type Segment = { from: Point; to: Point }

// Each line of points, dot to dot, that crosses the play area.
export function gridLines(view: BoardView): Segment[] {
    const { geometry } = view
    return AXES.flatMap((axis) =>
        geometry.points
            .filter((point) => !geometry.isPoint(addAxial(point, scaleAxial(axis, -1))))
            .flatMap((start) => {
                const points = [start]
                while (geometry.isPoint(addAxial(points[points.length - 1], axis))) {
                    points.push(addAxial(points[points.length - 1], axis))
                }
                const crossesPlay = points.some((point) => geometry.isSpot(point))
                const end = points[points.length - 1]
                return crossesPlay ? [{ from: view.center(start), to: view.center(end) }] : []
            })
    )
}

// The real board's fine grid, a fifth of the spacing: one tile of a repeating pattern.
const FINE = SPACING / 5
export const FINE_TILE = { width: FINE * Math.sqrt(3), height: FINE }
export const FINE_LINES = [-1, 0, 1].flatMap((k) => {
    const { width, height } = FINE_TILE
    return [
        { x1: (width / 2) * (k + 1), y1: -height, x2: (width / 2) * (k + 1), y2: 2 * height },
        { x1: -width, y1: (k - 1) * height, x2: 2 * width, y2: (k + 2) * height },
        { x1: -width, y1: (k + 2) * height, x2: 2 * width, y2: (k - 1) * height }
    ]
})

// The table the fine grid covers, out past the frame, where it fades away.
export function tableArea(frame: Frame) {
    const [x, y, width, height] = frame.viewBox.split(' ').map(Number)
    const spread = 0.3
    return {
        x: x - width * spread,
        y: y - height * spread,
        width: width * (1 + 2 * spread),
        height: height * (1 + 2 * spread)
    }
}

// The hexagon of E5's six neighbours, whose triangles the fine grid also covers.
export function centreTriangles(view: BoardView): string {
    const centre = view.center(CENTRE)
    return AXES.flatMap((axis) => [axis, scaleAxial(axis, -1)])
        .map((direction) => view.center(addAxial(CENTRE, direction)))
        .toSorted(
            (a, b) =>
                Math.atan2(a.y - centre.y, a.x - centre.x) -
                Math.atan2(b.y - centre.y, b.x - centre.x)
        )
        .map((point) => `${point.x},${point.y}`)
        .join(' ')
}

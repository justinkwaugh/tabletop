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

export type Box = { left: number; top: number; right: number; bottom: number }

// The board's box clips the table wherever the round fade has not finished: always at the frame's
// top, and at its sides on a narrow screen or its bottom on a short one. A band of the table's
// colour softens the grid inward from each edge the box cuts, and covers the table past it.
const EDGE_FADE = SPACING * 0.9

export function frameBox(frame: Frame): Box {
    const [left, top, width, height] = frame.viewBox.split(' ').map(Number)
    return { left, top, right: left + width, bottom: top + height }
}

export function edgeFades(seen: Box, table: ReturnType<typeof tableArea>) {
    const tableRight = table.x + table.width
    const tableBottom = table.y + table.height
    return [
        {
            side: 'top',
            rect: {
                x: table.x,
                y: table.y,
                width: table.width,
                height: seen.top + EDGE_FADE - table.y
            },
            line: { x1: 0, y1: seen.top, x2: 0, y2: seen.top + EDGE_FADE }
        },
        {
            side: 'bottom',
            rect: {
                x: table.x,
                y: seen.bottom - EDGE_FADE,
                width: table.width,
                height: tableBottom - seen.bottom + EDGE_FADE
            },
            line: { x1: 0, y1: seen.bottom, x2: 0, y2: seen.bottom - EDGE_FADE }
        },
        {
            side: 'left',
            rect: {
                x: table.x,
                y: table.y,
                width: seen.left + EDGE_FADE - table.x,
                height: table.height
            },
            line: { x1: seen.left, y1: 0, x2: seen.left + EDGE_FADE, y2: 0 }
        },
        {
            side: 'right',
            rect: {
                x: seen.right - EDGE_FADE,
                y: table.y,
                width: tableRight - seen.right + EDGE_FADE,
                height: table.height
            },
            line: { x1: seen.right, y1: 0, x2: seen.right - EDGE_FADE, y2: 0 }
        }
    ].filter(({ rect }) => rect.width > 0 && rect.height > 0)
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

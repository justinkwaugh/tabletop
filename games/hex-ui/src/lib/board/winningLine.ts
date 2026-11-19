import { assertExists, Color } from '@tabletop/common'
import { cellsAround, Edge, EDGES_OF, type HydratedHexBoard, type StoneColor } from '@tabletop/hex'
import { planCenter, SPACING, type Point } from './geometry.js'

// How far the line runs on past each end cell, into its edge's band.
const OVERRUN = SPACING * 0.7
// How tightly the line turns where the path bends.
const CORNER = SPACING * 0.32

// A line along a winning chain, edge to edge, in the board's plane: its path and its length.
export type WinningLine = { d: string; length: number }

// Each line runs from the edge it draws out of: Blue's from the left, Red's from the bottom, as
// the board is first drawn.
const FIRST_EDGE: Record<StoneColor, Edge> = { [Color.Blue]: Edge.Left, [Color.Red]: Edge.Bottom }

// The shortest run of the cells of the chain holding `cell` from one of the colour's edges to
// the other.
export function winningLine(board: HydratedHexBoard, color: StoneColor, cell: string): WinningLine {
    const { grid } = board
    const chain = new Set(board.chainAt(cell))
    const from = FIRST_EDGE[color]
    const to = EDGES_OF[color].find((edge) => edge !== from)
    assertExists(to, `${color} has two edges`)
    const starts = [...chain].filter((cell) => grid.edgesOf(cell).includes(from))
    const previous = new Map<string, string | undefined>(starts.map((cell) => [cell, undefined]))
    const queue = [...starts]
    let end: string | undefined
    for (let here = queue.shift(); here !== undefined; here = queue.shift()) {
        if (grid.edgesOf(here).includes(to)) {
            end = here
            break
        }
        for (const next of grid.neighborsOf(here)) {
            if (chain.has(next) && !previous.has(next)) {
                previous.set(next, here)
                queue.push(next)
            }
        }
    }
    assertExists(end, `The ${color} chain does not join its edges`)
    const cells: string[] = []
    for (let here: string | undefined = end; here !== undefined; here = previous.get(here)) {
        cells.unshift(here)
    }
    const centers = cells.map((cell) => planCenter(grid.cellOf(cell)))
    const points = [
        overrun(board, cells[0], centers[1] ?? centers[0]),
        ...centers,
        overrun(board, cells[cells.length - 1], centers[centers.length - 2] ?? centers[0])
    ]
    return roundedLine(points)
}

// Where the line ends past an end cell: on along its last step if that leads off the board,
// otherwise out through whichever side off the board lies nearest that way.
function overrun(board: HydratedHexBoard, cell: string, inward: Point): Point {
    const { grid } = board
    const own = grid.cellOf(cell)
    const center = planCenter(own)
    const along = unit({ x: center.x - inward.x, y: center.y - inward.y })
    const outward = cellsAround(own)
        .filter(
            ({ column, row }) => column < 0 || row < 0 || column >= grid.side || row >= grid.side
        )
        .map((off) => {
            const p = planCenter(off)
            return unit({ x: p.x - center.x, y: p.y - center.y })
        })
        .toSorted((a, b) => b.x * along.x + b.y * along.y - (a.x * along.x + a.y * along.y))
    const way = outward[0] ?? along
    return { x: center.x + way.x * OVERRUN, y: center.y + way.y * OVERRUN }
}

function unit(p: Point): Point {
    const length = Math.hypot(p.x, p.y)
    return length === 0 ? { x: 0, y: 0 } : { x: p.x / length, y: p.y / length }
}

// Straight runs between the points, each bend rounded by a curve, measured as it goes.
function roundedLine(points: readonly Point[]): WinningLine {
    const f = (p: Point) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`
    const toward = (a: Point, b: Point, d: number): Point => {
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        return { x: a.x + ((b.x - a.x) * d) / length, y: a.y + ((b.y - a.y) * d) / length }
    }
    let d = `M${f(points[0])}`
    let length = 0
    let pen = points[0]
    for (let i = 1; i < points.length; i++) {
        const corner = points[i]
        const last = i === points.length - 1
        const before = points[i - 1]
        const after = points[i + 1]
        const straight =
            last ||
            Math.abs(
                (corner.x - before.x) * (after.y - corner.y) -
                    (corner.y - before.y) * (after.x - corner.x)
            ) < 0.01
        if (straight) {
            d += ` L${f(corner)}`
            length += Math.hypot(corner.x - pen.x, corner.y - pen.y)
            pen = corner
            continue
        }
        const reach = Math.min(
            CORNER,
            Math.hypot(corner.x - before.x, corner.y - before.y) / 2,
            Math.hypot(after.x - corner.x, after.y - corner.y) / 2
        )
        const into = toward(corner, before, reach)
        const out = toward(corner, after, reach)
        d += ` L${f(into)} Q${f(corner)} ${f(out)}`
        length += Math.hypot(into.x - pen.x, into.y - pen.y)
        length += curveLength(into, corner, out)
        pen = out
    }
    return { d, length }
}

function curveLength(a: Point, c: Point, b: Point): number {
    let total = 0
    let previous = a
    for (let step = 1; step <= 16; step++) {
        const t = step / 16
        const p = {
            x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
            y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y
        }
        total += Math.hypot(p.x - previous.x, p.y - previous.y)
        previous = p
    }
    return total
}

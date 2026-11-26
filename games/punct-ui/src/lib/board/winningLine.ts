import { addAxial, assertExists, type AxialCoordinates, type Point } from '@tabletop/common'
import {
    AXES,
    BOARD_RADIUS,
    DIRECTIONS,
    neighbours,
    spaceKey,
    type HydratedPunctBoard
} from '@tabletop/punct'
import type { BoardView } from './geometry.js'

const OVERRUN = 0.55
const CORNER = 18

type Axis = (coords: AxialCoordinates) => number

export type WinningRun = { cells: AxialCoordinates[]; axis: Axis }

// The shortest run of the chain's spaces joining a pair of opposite sides.
export function winningRun(chain: readonly AxialCoordinates[]): WinningRun {
    const keys = new Set(chain.map(spaceKey))
    let best: WinningRun | undefined
    for (const axis of AXES) {
        const starts = chain.filter((coords) => axis(coords) === -BOARD_RADIUS)
        const previous = new Map<number, AxialCoordinates | undefined>(
            starts.map((coords) => [spaceKey(coords), undefined])
        )
        const queue = [...starts]
        let end: AxialCoordinates | undefined
        for (let here = queue.shift(); here !== undefined; here = queue.shift()) {
            if (axis(here) === BOARD_RADIUS) {
                end = here
                break
            }
            for (const next of neighbours(here)) {
                const key = spaceKey(next)
                if (keys.has(key) && !previous.has(key)) {
                    previous.set(key, here)
                    queue.push(next)
                }
            }
        }
        if (end === undefined) continue
        const run: AxialCoordinates[] = []
        for (
            let here: AxialCoordinates | undefined = end;
            here;
            here = previous.get(spaceKey(here))
        ) {
            run.unshift(here)
        }
        if (best === undefined || run.length < best.cells.length) best = { cells: run, axis }
    }
    assertExists(best, 'A winning chain joins two opposite sides')
    return best
}

// Over the top of each dot of the run, and on past each end towards its side.
export function winningLine(
    board: HydratedPunctBoard,
    { cells, axis }: WinningRun,
    view: BoardView
): string {
    const top = (coords: AxialCoordinates, plan = view.plan(coords)) =>
        view.project(plan, view.surface(board.heightAt(coords)))
    const first = cells[0]
    const last = cells[cells.length - 1]
    return roundedLine([
        top(first, beyondSide(first, axis, view)),
        ...cells.map((coords) => top(coords)),
        top(last, beyondSide(last, axis, view))
    ])
}

// Square to a side lies midway between the two neighbours further out on its axis.
function beyondSide(end: AxialCoordinates, axis: Axis, view: BoardView): Point {
    const out = Math.sign(axis(end))
    const steps = DIRECTIONS.filter((step) => axis(step) === out)
    const at = view.plan(end)
    const beyond = steps.map((step) => view.plan(addAxial(end, step)))
    const x = beyond.reduce((sum, p) => sum + p.x, 0) / beyond.length
    const y = beyond.reduce((sum, p) => sum + p.y, 0) / beyond.length
    return { x: at.x + (x - at.x) * OVERRUN, y: at.y + (y - at.y) * OVERRUN }
}

function roundedLine(points: readonly Point[]): string {
    const f = (p: Point) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`
    const toward = (a: Point, b: Point, d: number): Point => {
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        return { x: a.x + ((b.x - a.x) * d) / length, y: a.y + ((b.y - a.y) * d) / length }
    }
    let d = `M${f(points[0])}`
    for (let i = 1; i < points.length; i++) {
        const corner = points[i]
        const before = points[i - 1]
        const after = points[i + 1]
        const straight =
            after === undefined ||
            Math.abs(
                (corner.x - before.x) * (after.y - corner.y) -
                    (corner.y - before.y) * (after.x - corner.x)
            ) < 0.01
        if (straight) {
            d += ` L${f(corner)}`
            continue
        }
        const reach = Math.min(
            CORNER,
            Math.hypot(corner.x - before.x, corner.y - before.y) / 2,
            Math.hypot(after.x - corner.x, after.y - corner.y) / 2
        )
        d += ` L${f(toward(corner, before, reach))} Q${f(corner)} ${f(toward(corner, after, reach))}`
    }
    return d
}

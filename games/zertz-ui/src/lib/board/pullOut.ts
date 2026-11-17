import {
    addAxial,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    FlatNeighborOffsets,
    sameCoordinates,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { RING_SPACING, type BoardView } from './geometry.js'

const NEIGHBOR_OFFSETS = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

// As on the real board, a ring slides out without touching the rings that stay: toward an open
// side whose sides are open too, or between two adjacent open sides (rulebook section B). Out of
// the middle column they take a diagonal, since straight up the screen read as lifting away.
export function pullOuts(
    view: BoardView,
    removed: readonly AxialCoordinates[],
    staying: readonly AxialCoordinates[],
    layout: readonly AxialCoordinates[]
): Map<number, Point> {
    const plane = (coords: AxialCoordinates): Point => {
        const { x, y } = view.center(coords)
        return { x, y: y / view.tilt }
    }
    const middle = mean(layout.map(plane))
    const taken = new Set([...staying, ...removed].map(coordinatesToNumber))
    const pulls = new Map<number, Point>()
    for (const group of touchingGroups(removed)) {
        const start = plane(group[0])
        const steps = NEIGHBOR_OFFSETS.map((offset) => {
            const to = plane(addAxial(group[0], offset))
            return { offset, x: to.x - start.x, y: to.y - start.y }
        })
        const open = steps.filter(({ offset }) =>
            group.some((coords) => !taken.has(coordinatesToNumber(addAxial(coords, offset))))
        )
        const inGroup = new Set(group.map(coordinatesToNumber))
        const blocking = steps.filter(({ offset }) =>
            group.some((coords) => {
                const key = coordinatesToNumber(addAxial(coords, offset))
                return taken.has(key) && !inGroup.has(key)
            })
        )
        // A ring sliding one way brushes any neighbour less than a right angle off its path.
        const clear = slideDirections(steps).filter((way) =>
            blocking.every((step) => step.x * way.x + step.y * way.y < RING_SPACING ** 2 * 1e-6)
        )
        const centre = mean(group.map(plane))
        const away = { x: centre.x - middle.x, y: centre.y - middle.y }
        const facing = (step: Point) =>
            (step.x * away.x + step.y * away.y) / Math.hypot(step.x, step.y)
        let ways: Point[] = clear.length > 0 ? clear : open.length > 0 ? open : steps
        const diagonals = ways.filter((step) => Math.abs(step.x) > RING_SPACING * 0.1)
        const inMiddleColumn = Math.abs(centre.x - middle.x) < RING_SPACING * 0.25
        if (!inMiddleColumn && diagonals.length > 0) ways = diagonals
        const along = ways.reduce((best, step) => (facing(step) > facing(best) ? step : best))
        const pull = { x: along.x, y: along.y * view.tilt }
        for (const coords of group) pulls.set(coordinatesToNumber(coords), pull)
    }
    return pulls
}

// Toward each neighbour, and between each pair of adjacent neighbours, a ring spacing long.
function slideDirections(steps: readonly Point[]): Point[] {
    return steps.flatMap((step, index) => {
        const next = steps[(index + 1) % steps.length]
        const between = { x: step.x + next.x, y: step.y + next.y }
        const scale = RING_SPACING / Math.hypot(between.x, between.y)
        return [
            { x: step.x, y: step.y },
            { x: between.x * scale, y: between.y * scale }
        ]
    })
}

function touchingGroups(rings: readonly AxialCoordinates[]): AxialCoordinates[][] {
    const left = new Map(rings.map((coords) => [coordinatesToNumber(coords), coords]))
    const groups: AxialCoordinates[][] = []
    for (const start of rings) {
        if (!left.delete(coordinatesToNumber(start))) continue
        const group = [start]
        for (let index = 0; index < group.length; index++) {
            for (const offset of NEIGHBOR_OFFSETS) {
                const next = left.get(coordinatesToNumber(addAxial(group[index], offset)))
                if (next !== undefined) {
                    left.delete(coordinatesToNumber(next))
                    group.push(next)
                }
            }
        }
        groups.push(group)
    }
    return groups
}

function mean(points: readonly Point[]): Point {
    const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), {
        x: 0,
        y: 0
    })
    return { x: sum.x / points.length, y: sum.y / points.length }
}

export type RingExit = { first?: Point; out: Point; waits: boolean }

export function ringExits(
    view: BoardView,
    layout: readonly AxialCoordinates[],
    removed: readonly AxialCoordinates[],
    staying: readonly AxialCoordinates[],
    move?: { remove: AxialCoordinates; cutOff: readonly AxialCoordinates[] }
): Map<number, RingExit> {
    const pulls = pullOuts(view, removed, staying, layout)
    const exits = new Map<number, RingExit>()
    for (const [key, out] of pulls) exits.set(key, { out, waits: false })
    if (move === undefined || move.cutOff.length === 0) return exits

    const removeKey = coordinatesToNumber(move.remove)
    const first = pullOuts(view, [move.remove], [...staying, ...move.cutOff], layout).get(removeKey)
    const groups = pullOuts(view, move.cutOff, staying, layout)
    for (const coords of move.cutOff) {
        const out = groups.get(coordinatesToNumber(coords))
        if (out !== undefined) exits.set(coordinatesToNumber(coords), { out, waits: true })
    }
    const beside =
        move.cutOff.find((coords) =>
            NEIGHBOR_OFFSETS.some((offset) =>
                sameCoordinates(addAxial(move.remove, offset), coords)
            )
        ) ?? move.cutOff[0]
    const along = groups.get(coordinatesToNumber(beside))
    if (first !== undefined && along !== undefined) {
        exits.set(removeKey, {
            first,
            out: { x: first.x + along.x, y: first.y + along.y },
            waits: false
        })
    }
    return exits
}

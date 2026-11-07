import {
    addAxial,
    ClockwiseFlatHexDirections,
    FlatNeighborOffsets,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { coordsKey, RING_SPACING, type BoardView } from './geometry.js'

const NEIGHBOR_OFFSETS = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

// Where removed rings slide to as they are pulled off the table, on screen, by key. As on the real
// board, a ring comes out through an open side, where no ring that stays stands, along a line of
// rings: of its open sides, the one facing most nearly away from the board's middle. Out of the
// middle column they leave along a diagonal where one is open, since straight up the screen read
// as lifting away; the middle column's end rings go straight up or down it. Rings removed
// together that touch go as one, through an open side of the group. Each goes a ring's width.
export function pullOuts(
    view: BoardView,
    removed: readonly AxialCoordinates[],
    staying: readonly AxialCoordinates[],
    layout: readonly AxialCoordinates[]
): Map<string, Point> {
    // On the table, seen from above, where the screen squashes depth by the tilt.
    const plane = (coords: AxialCoordinates): Point => {
        const { x, y } = view.center(coords)
        return { x, y: y / view.tilt }
    }
    const middle = mean(layout.map(plane))
    const taken = new Set([...staying, ...removed].map(coordsKey))
    const pulls = new Map<string, Point>()
    for (const group of touchingGroups(removed)) {
        const start = plane(group[0])
        const steps = NEIGHBOR_OFFSETS.map((offset) => {
            const to = plane(addAxial(group[0], offset))
            return { offset, x: to.x - start.x, y: to.y - start.y }
        })
        const open = steps.filter(({ offset }) =>
            group.some((coords) => !taken.has(coordsKey(addAxial(coords, offset))))
        )
        const centre = mean(group.map(plane))
        const away = { x: centre.x - middle.x, y: centre.y - middle.y }
        const facing = (step: Point) =>
            (step.x * away.x + step.y * away.y) / Math.hypot(step.x, step.y)
        let ways = open.length > 0 ? open : steps
        const diagonals = ways.filter((step) => Math.abs(step.x) > RING_SPACING * 0.1)
        const inMiddleColumn = Math.abs(centre.x - middle.x) < RING_SPACING * 0.25
        if (!inMiddleColumn && diagonals.length > 0) ways = diagonals
        const along = ways.reduce((best, step) => (facing(step) > facing(best) ? step : best))
        const pull = { x: along.x, y: along.y * view.tilt }
        for (const coords of group) pulls.set(coordsKey(coords), pull)
    }
    return pulls
}

function touchingGroups(rings: readonly AxialCoordinates[]): AxialCoordinates[][] {
    const left = new Map(rings.map((coords) => [coordsKey(coords), coords]))
    const groups: AxialCoordinates[][] = []
    for (const start of rings) {
        if (!left.delete(coordsKey(start))) continue
        const group = [start]
        for (let index = 0; index < group.length; index++) {
            for (const offset of NEIGHBOR_OFFSETS) {
                const next = left.get(coordsKey(addAxial(group[index], offset)))
                if (next !== undefined) {
                    left.delete(coordsKey(next))
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

// How each of a move's removed rings leaves: a ring's width out (`out`, on screen), and, for the
// ring the move removes when that cuts groups off, a first slide out of its place (`first`) the
// way it is free to go among every ring still there; it then leaves beside the group it cut off,
// which waits for it (`waits`), rather than through them.
export type RingExit = { first?: Point; out: Point; waits: boolean }

export function ringExits(
    view: BoardView,
    layout: readonly AxialCoordinates[],
    removed: readonly AxialCoordinates[],
    staying: readonly AxialCoordinates[],
    move?: { remove: AxialCoordinates; cutOff: readonly AxialCoordinates[] }
): Map<string, RingExit> {
    const pulls = pullOuts(view, removed, staying, layout)
    const exits = new Map<string, RingExit>()
    for (const [key, out] of pulls) exits.set(key, { out, waits: false })
    if (move === undefined || move.cutOff.length === 0) return exits

    const removeKey = coordsKey(move.remove)
    const first = pullOuts(view, [move.remove], [...staying, ...move.cutOff], layout).get(removeKey)
    const groups = pullOuts(view, move.cutOff, staying, layout)
    for (const coords of move.cutOff) {
        const out = groups.get(coordsKey(coords))
        if (out !== undefined) exits.set(coordsKey(coords), { out, waits: true })
    }
    const beside =
        move.cutOff.find((coords) =>
            NEIGHBOR_OFFSETS.some(
                (offset) => coordsKey(addAxial(move.remove, offset)) === coordsKey(coords)
            )
        ) ?? move.cutOff[0]
    const along = groups.get(coordsKey(beside))
    if (first !== undefined && along !== undefined) {
        exits.set(removeKey, {
            first,
            out: { x: first.x + along.x, y: first.y + along.y },
            waits: false
        })
    }
    return exits
}

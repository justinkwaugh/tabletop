import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { DIRECTIONS, stepsFrom, type HydratedDvonnBoard, type Piece } from '@tabletop/dvonn'

export type PlacedStack = { coords: AxialCoordinates; pieces: Piece[] }

export type StackMotion = {
    from: AxialCoordinates
    to: AxialCoordinates
    pieces: Piece[]
    // How many pieces stay under the moving ones where they start, and wait for them where
    // they land.
    leftBelow: number
    landingOn: number
    // A move played, rather than taken back.
    forward: boolean
}

export type BoardDiff = {
    moved?: StackMotion
    appeared: PlacedStack[]
    vanished: PlacedStack[]
}

function stacks(board: HydratedDvonnBoard): PlacedStack[] {
    return board.spaces
        .filter((space) => space.stack.length > 0)
        .map((space) => ({ coords: space.coords, pieces: space.stack }))
}

function samePieces(a: readonly Piece[], b: readonly Piece[]): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

function stackAt(list: readonly PlacedStack[], coords: AxialCoordinates): Piece[] {
    return list.find((stack) => sameCoordinates(stack.coords, coords))?.pieces ?? []
}

function isHop(from: AxialCoordinates, to: AxialCoordinates, height: number): boolean {
    return DIRECTIONS.some((direction) => sameCoordinates(stepsFrom(from, direction, height), to))
}

// Whether the whole stack at `from` in `before` now tops the stack at `to` in `after`.
function movedOnto(
    before: PlacedStack[],
    after: PlacedStack[],
    from: AxialCoordinates,
    to: AxialCoordinates
): StackMotion | undefined {
    const moving = stackAt(before, from)
    const was = stackAt(before, to)
    if (
        moving.length === 0 ||
        was.length === 0 ||
        stackAt(after, from).length > 0 ||
        !samePieces(stackAt(after, to), [...was, ...moving])
    ) {
        return undefined
    }
    return { from, to, pieces: moving, leftBelow: 0, landingOn: was.length, forward: true }
}

// A stack that left one space and now tops another as far away as it is tall, read forwards
// (a move) or backwards (its undo), from the two boards alone.
function findMove(before: PlacedStack[], after: PlacedStack[]): StackMotion | undefined {
    for (const origin of before) {
        for (const target of after) {
            if (!isHop(origin.coords, target.coords, origin.pieces.length)) continue
            const move = movedOnto(before, after, origin.coords, target.coords)
            if (move) return move
        }
    }
    return undefined
}

// What changed between two boards. `known` is the move the session knows was played or taken
// back, used when it turns one board into the other.
export function boardDiff(
    from: HydratedDvonnBoard,
    to: HydratedDvonnBoard,
    known?: { from: AxialCoordinates; to: AxialCoordinates }
): BoardDiff {
    const before = stacks(from)
    const after = stacks(to)
    const forward =
        (known && movedOnto(before, after, known.from, known.to)) ?? findMove(before, after)
    const backward = forward
        ? undefined
        : ((known && movedOnto(after, before, known.from, known.to)) ?? findMove(after, before))
    const moved: StackMotion | undefined = backward && {
        from: backward.to,
        to: backward.from,
        pieces: backward.pieces,
        leftBelow: backward.landingOn,
        landingOn: 0,
        forward: false
    }
    const motion = forward ?? moved
    const isMotionSpace = (coords: AxialCoordinates) =>
        motion !== undefined &&
        (sameCoordinates(coords, motion.from) || sameCoordinates(coords, motion.to))

    return {
        moved: motion,
        appeared: after.filter(
            (stack) => !isMotionSpace(stack.coords) && stackAt(before, stack.coords).length === 0
        ),
        vanished: before.filter(
            (stack) => !isMotionSpace(stack.coords) && stackAt(after, stack.coords).length === 0
        )
    }
}

// The spaces a hop from `from` to `to` passes over, in order.
export function spacesBetween(from: AxialCoordinates, to: AxialCoordinates): AxialCoordinates[] {
    for (const direction of DIRECTIONS) {
        for (let distance = 1; distance <= 10; distance++) {
            if (sameCoordinates(stepsFrom(from, direction, distance), to)) {
                return Array.from({ length: distance - 1 }, (_, index) =>
                    stepsFrom(from, direction, index + 1)
                )
            }
        }
    }
    return []
}

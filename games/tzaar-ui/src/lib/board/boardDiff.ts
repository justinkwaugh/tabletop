import { addAxial, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { DIRECTIONS, type HydratedTzaarBoard, type Piece } from '@tabletop/tzaar'

export type PlacedStack = { coords: AxialCoordinates; pieces: Piece[] }

export type StackMotion = {
    from: AxialCoordinates
    to: AxialCoordinates
    pieces: Piece[]
    // How many pieces stay under the moving ones where they start, and wait for them where
    // they land.
    leftBelow: number
    landingOn: number
    // The stack a capture takes from where the moving stack lands; taken back, it returns there
    // once the moving stack has left.
    captured: Piece[]
    // A move played, rather than taken back.
    forward: boolean
}

export type BoardDiff = {
    moved?: StackMotion
    appeared: PlacedStack[]
    vanished: PlacedStack[]
}

function stacks(board: HydratedTzaarBoard): PlacedStack[] {
    return board.spaces
        .filter((space) => space.stack.length > 0)
        .map((space) => ({ coords: space.coords, pieces: space.stack }))
}

function samePieces(a: readonly Piece[], b: readonly Piece[]): boolean {
    return a.length === b.length && a.every((piece, index) => piece.id === b[index].id)
}

function stackAt(list: readonly PlacedStack[], coords: AxialCoordinates): Piece[] {
    return list.find((stack) => sameCoordinates(stack.coords, coords))?.pieces ?? []
}

// Whether the whole stack at `from` in `before` now stands at `to` in `after`: on the stack it
// found there, or in place of an opponent's stack it captured.
function movedTo(
    before: PlacedStack[],
    after: PlacedStack[],
    from: AxialCoordinates,
    to: AxialCoordinates
): StackMotion | undefined {
    const moving = stackAt(before, from)
    const was = stackAt(before, to)
    const now = stackAt(after, to)
    if (moving.length === 0 || was.length === 0 || stackAt(after, from).length > 0) {
        return undefined
    }
    const motion = { from, to, pieces: moving, leftBelow: 0, forward: true }
    if (samePieces(now, [...was, ...moving])) {
        return { ...motion, landingOn: was.length, captured: [] }
    }
    if (samePieces(now, moving)) {
        return { ...motion, landingOn: 0, captured: was }
    }
    return undefined
}

function inLine(from: AxialCoordinates, to: AxialCoordinates): boolean {
    return spacesBetween(from, to) !== undefined
}

// A stack that left one space and now stands on another in line with it, read forwards (a move)
// or backwards (its undo), from the two boards alone.
function findMove(before: PlacedStack[], after: PlacedStack[]): StackMotion | undefined {
    for (const origin of before) {
        for (const target of after) {
            if (!inLine(origin.coords, target.coords)) continue
            const move = movedTo(before, after, origin.coords, target.coords)
            if (move) return move
        }
    }
    return undefined
}

// What changed between two boards. `known` is the move the session knows was played or taken
// back, used when it turns one board into the other.
export function boardDiff(
    from: HydratedTzaarBoard,
    to: HydratedTzaarBoard,
    known?: { from: AxialCoordinates; to: AxialCoordinates }
): BoardDiff {
    const before = stacks(from)
    const after = stacks(to)
    const forward =
        (known && movedTo(before, after, known.from, known.to)) ?? findMove(before, after)
    const backward = forward
        ? undefined
        : ((known && movedTo(after, before, known.from, known.to)) ?? findMove(after, before))
    const reversed: StackMotion | undefined = backward && {
        from: backward.to,
        to: backward.from,
        pieces: backward.pieces,
        leftBelow: backward.landingOn,
        landingOn: 0,
        captured: backward.captured,
        forward: false
    }
    const motion = forward ?? reversed
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

// The spaces a move from `from` to `to` passes over, in order; undefined when they are not in
// line.
export function spacesBetween(
    from: AxialCoordinates,
    to: AxialCoordinates
): AxialCoordinates[] | undefined {
    for (const direction of DIRECTIONS) {
        const passed: AxialCoordinates[] = []
        for (let at = addAxial(from, direction); passed.length < 9; at = addAxial(at, direction)) {
            if (sameCoordinates(at, to)) return passed
            passed.push(at)
        }
    }
    return undefined
}

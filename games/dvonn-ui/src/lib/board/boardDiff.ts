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

// A stack that left one space and now tops another as far away as it is tall, read forwards
// (a move) or backwards (its undo), from the two boards alone.
function findMove(before: PlacedStack[], after: PlacedStack[]): StackMotion | undefined {
    for (const origin of before) {
        if (stackAt(after, origin.coords).length > 0) continue
        for (const target of after) {
            const was = stackAt(before, target.coords)
            if (
                was.length > 0 &&
                isHop(origin.coords, target.coords, origin.pieces.length) &&
                target.pieces.length === was.length + origin.pieces.length &&
                samePieces(target.pieces, [...was, ...origin.pieces])
            ) {
                return {
                    from: origin.coords,
                    to: target.coords,
                    pieces: origin.pieces,
                    leftBelow: 0,
                    landingOn: was.length
                }
            }
        }
    }
    return undefined
}

export function boardDiff(from: HydratedDvonnBoard, to: HydratedDvonnBoard): BoardDiff {
    const before = stacks(from)
    const after = stacks(to)
    const forward = findMove(before, after)
    const backward = forward ? undefined : findMove(after, before)
    const moved: StackMotion | undefined = backward && {
        from: backward.to,
        to: backward.from,
        pieces: backward.pieces,
        leftBelow: backward.landingOn,
        landingOn: 0
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

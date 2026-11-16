import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import {
    DIRECTIONS,
    spaceKey,
    stepsFrom,
    type HydratedDvonnBoard,
    type Piece,
    type Stack
} from '@tabletop/dvonn'

// Pieces leaving one space for another together: a stack moved, or taken back.
export type StackMotion = {
    from: AxialCoordinates
    to: AxialCoordinates
    pieces: Piece[]
    // How many pieces stay under the moving ones where they start, and wait for them where they
    // land.
    leftBelow: number
    landingOn: number
}

export type BoardDiff = {
    moved: StackMotion[]
    // Stacks on the board in only one of the two, whole.
    appeared: Stack[]
    vanished: Stack[]
}

// A piece's identity: the space it was placed on, which no other piece shares.
export function pieceKey(piece: Piece): number {
    return spaceKey(piece.placedAt)
}

function spaceOf(board: HydratedDvonnBoard): Map<number, AxialCoordinates> {
    const spaces = new Map<number, AxialCoordinates>()
    for (const stack of board.stacks) {
        for (const piece of stack.pieces) spaces.set(pieceKey(piece), stack.coords)
    }
    return spaces
}

// What changed between two boards, read from the pieces alone, so undo and history steps, which
// carry no action, animate the same way in both directions, however many moves lie between. Each
// run of pieces in a stack of `to` that came from another space is a motion; a stack whose every
// piece is new appeared, and one whose every piece is gone vanished.
export function boardDiff(from: HydratedDvonnBoard, to: HydratedDvonnBoard): BoardDiff {
    const before = spaceOf(from)
    const after = spaceOf(to)
    const moved: StackMotion[] = []
    for (const stack of to.stacks) {
        let run: StackMotion | undefined
        stack.pieces.forEach((piece, index) => {
            const origin = before.get(pieceKey(piece))
            if (origin === undefined || sameCoordinates(origin, stack.coords)) {
                run = undefined
                return
            }
            if (run !== undefined && sameCoordinates(run.from, origin)) {
                run.pieces.push(piece)
                return
            }
            const leftBelow = from
                .stackAt(origin)
                .filter((other) =>
                    sameCoordinates(after.get(pieceKey(other)) ?? stack.coords, origin)
                ).length
            run = { from: origin, to: stack.coords, pieces: [piece], leftBelow, landingOn: index }
            moved.push(run)
        })
    }
    return {
        moved,
        appeared: to.stacks.filter((stack) =>
            stack.pieces.every((piece) => !before.has(pieceKey(piece)))
        ),
        vanished: from.stacks.filter((stack) =>
            stack.pieces.every((piece) => !after.has(pieceKey(piece)))
        )
    }
}

// How many spaces apart two spaces are.
export function spacesApart(from: AxialCoordinates, to: AxialCoordinates): number {
    return Math.max(
        Math.abs(to.q - from.q),
        Math.abs(to.r - from.r),
        Math.abs(to.q + to.r - from.q - from.r)
    )
}

// The spaces a hop from `from` to `to` passes over, in order. A move runs along one line; a
// history jump over several moves can carry pieces between spaces that are not, and passes over
// no space in particular.
export function spacesBetween(from: AxialCoordinates, to: AxialCoordinates): AxialCoordinates[] {
    const distance = spacesApart(from, to)
    const direction = DIRECTIONS.find((step) =>
        sameCoordinates(stepsFrom(from, step, distance), to)
    )
    if (direction === undefined) return []
    return Array.from({ length: distance - 1 }, (_, index) => stepsFrom(from, direction, index + 1))
}

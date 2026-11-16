import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { spaceKey, type Piece, type PieceStack, type TzaarBoard } from '@tabletop/tzaar'

// Pieces that leave one space together for another, bottom to top.
export type Run = {
    pieces: Piece[]
    start: AxialCoordinates
    end: AxialCoordinates
    // How many pieces stay on the start space under it, and how many it lands on at the end.
    leftBelow: number
    landingOn: number
}

// What changes on the board between two states, piece by piece.
export type BoardDiff = {
    runs: Run[]
    // Stacks that leave the board, or come onto it, with every piece in them.
    vanished: PieceStack[]
    appeared: PieceStack[]
}

type Place = { coords: AxialCoordinates; index: number }

// Each piece's moves from one board to the next, read by its id, so any number of moves between
// the two boards is read alike: each run goes straight from where it stood to where it ends.
export function boardDiff(from: TzaarBoard, to: TzaarBoard): BoardDiff {
    const before = locate(from)
    const after = locate(to)
    const runs = new Map<string, Run>()

    for (const stack of from.stacks) {
        stack.pieces.forEach((piece, index) => {
            const now = after.get(piece.id)
            if (now === undefined || sameCoordinates(now.coords, stack.coords)) return
            const key = `${spaceKey(stack.coords)}>${spaceKey(now.coords)}`
            const run = runs.get(key) ?? {
                pieces: [],
                start: stack.coords,
                end: now.coords,
                leftBelow: index,
                landingOn: now.index
            }
            run.pieces.push(piece)
            runs.set(key, run)
        })
    }

    return {
        runs: [...runs.values()],
        vanished: from.stacks.filter((stack) =>
            stack.pieces.every((piece) => !after.has(piece.id))
        ),
        appeared: to.stacks.filter((stack) => stack.pieces.every((piece) => !before.has(piece.id)))
    }
}

function locate(board: TzaarBoard): Map<number, Place> {
    const located = new Map<number, Place>()
    for (const stack of board.stacks) {
        stack.pieces.forEach((piece, index) =>
            located.set(piece.id, { coords: stack.coords, index })
        )
    }
    return located
}

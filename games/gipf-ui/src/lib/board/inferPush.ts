import { sameCoordinates } from '@tabletop/common'
import { ENTRIES, HydratedGipfBoard, type Entry, type Piece, type PushPiece } from '@tabletop/gipf'
import { coordsKey } from './geometry.js'

export type InferredPush = {
    entry: Entry
    shifted: number
    piece: Piece
    // Whether the step goes forward through the push, or back out of it.
    forward: boolean
}

// A history step or Undo carries no action, so a push is read from the boards: some way in,
// pushed with the piece that ends on its first spot, turns one board into the other. A piece that
// moved nothing along could have come from any dot beside its spot, so a step that knows the push
// it shows (the one undone, or the one history stepped to) follows it, if it fits the boards.
export function inferPush(
    before: HydratedGipfBoard,
    after: HydratedGipfBoard,
    known?: PushPiece
): InferredPush | undefined {
    const entry =
        known &&
        ENTRIES.find(
            (e) => sameCoordinates(e.dot, known.dot) && sameCoordinates(e.line[0], known.to)
        )
    const found = entry && pushEither(before, after, [entry])
    return found ?? pushEither(before, after, ENTRIES)
}

function pushEither(
    before: HydratedGipfBoard,
    after: HydratedGipfBoard,
    entries: readonly Entry[]
): InferredPush | undefined {
    return pushBetween(before, after, true, entries) ?? pushBetween(after, before, false, entries)
}

function pushBetween(
    start: HydratedGipfBoard,
    end: HydratedGipfBoard,
    forward: boolean,
    entries: readonly Entry[]
): InferredPush | undefined {
    const target = layout(end)
    for (const entry of entries) {
        const piece = end.pieceAt(entry.line[0])
        if (piece === undefined || !start.canPush(entry)) continue
        const board = new HydratedGipfBoard(start.dehydrate())
        const shifted = entry.line.findIndex((coords) => board.pieceAt(coords) === undefined)
        board.push(entry, piece)
        if (layout(board) === target) {
            return { entry, shifted, piece, forward }
        }
    }
    return undefined
}

function layout(board: HydratedGipfBoard): string {
    return board
        .pieces()
        .map((piece) => `${coordsKey(piece.coords)}:${piece.playerId}:${piece.gipf}`)
        .toSorted()
        .join('|')
}

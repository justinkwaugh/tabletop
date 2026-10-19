import { ENTRIES, HydratedGipfBoard, type Entry, type Piece } from '@tabletop/gipf'
import { coordsKey } from './geometry.js'

export type InferredPush = {
    entry: Entry
    shifted: number
    piece: Piece
    // Whether the step goes forward through the push, or back out of it.
    forward: boolean
}

// A history step or Undo carries no action, so a push is read from the boards: some way in,
// pushed with the piece that ends on its first spot, turns one board into the other.
export function inferPush(
    before: HydratedGipfBoard,
    after: HydratedGipfBoard
): InferredPush | undefined {
    return pushBetween(before, after, true) ?? pushBetween(after, before, false)
}

function pushBetween(
    start: HydratedGipfBoard,
    end: HydratedGipfBoard,
    forward: boolean
): InferredPush | undefined {
    const target = layout(end)
    for (const entry of ENTRIES) {
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

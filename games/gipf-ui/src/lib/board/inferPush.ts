import { coordinatesToNumber, sameCoordinates } from '@tabletop/common'
import { ENTRIES, HydratedGipfBoard, type Entry, type Piece, type PushPiece } from '@tabletop/gipf'

export type InferredPush = {
    entry: Entry
    shifted: number
    piece: Piece
    forward: boolean
}

// A push that moved nothing fits any dot beside its spot, so a known push is tried first.
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
    return board.pieces
        .map((piece) => `${coordinatesToNumber(piece.coords)}:${piece.playerId}:${piece.gipf}`)
        .toSorted()
        .join('|')
}

import type { AxialCoordinates } from '@tabletop/common'
import { dotsOf, type HydratedPunctBoard, type PlacedPiece } from '@tabletop/punct'
import { includesCoords, type BoardView } from './geometry.js'

// A space the chosen piece's PÜNCT can go to, the piece on top there if any, and how high its
// top surface stands.
export type DestinationMark = { coords: AxialCoordinates; onPieceId?: number; height: number }

export type DestinationMarks = {
    // On empty spaces: they lie on the board, under every piece.
    onBoard: DestinationMark[]
    // On a piece's top dot: drawn with that piece, so nearer pieces cover them.
    onPieces: Map<number, DestinationMark[]>
    // Their click areas, and the rings of spaces under the chosen piece itself, over everything,
    // nearer ones last.
    raised: DestinationMark[]
}

// Once a space is chosen the other destinations stay, to choose instead, all but those under the
// hovering piece.
export function destinationMarks(
    board: HydratedPunctBoard,
    piece: PlacedPiece | undefined,
    destinations: readonly AxialCoordinates[],
    stagedCells: readonly AxialCoordinates[],
    view: BoardView
): DestinationMarks {
    const marks: DestinationMarks = { onBoard: [], onPieces: new Map(), raised: [] }
    if (piece === undefined) return marks
    const underPiece = dotsOf(piece.kind, piece.punct, piece.rotation)
    for (const coords of destinations) {
        if (includesCoords(stagedCells, coords)) continue
        const mark = {
            coords,
            onPieceId: board.topAt(coords, piece.id)?.piece.id,
            height: board.heightAt(coords, piece.id)
        }
        if (mark.onPieceId !== undefined) {
            marks.onPieces.set(mark.onPieceId, [
                ...(marks.onPieces.get(mark.onPieceId) ?? []),
                mark
            ])
        }
        if (mark.onPieceId !== undefined || includesCoords(underPiece, coords)) {
            marks.raised.push(mark)
        } else {
            marks.onBoard.push(mark)
        }
    }
    marks.raised.sort((a, b) => view.center(a.coords).y - view.center(b.coords).y)
    return marks
}

// The piece's dots in the winning chain where it is the top piece.
export function winningDots(
    board: HydratedPunctBoard,
    piece: PlacedPiece,
    connection: readonly AxialCoordinates[]
): AxialCoordinates[] {
    return dotsOf(piece.kind, piece.punct, piece.rotation).filter(
        (cell) => includesCoords(connection, cell) && board.topAt(cell)?.piece.id === piece.id
    )
}

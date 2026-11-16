import { sameCoordinates } from '@tabletop/common'
import type { PlacedPiece, PunctBoard } from '@tabletop/punct'

export type MovedPiece = { was: PlacedPiece; piece: PlacedPiece }

// What a step does to the board, piece by piece: the pieces it brings in, those it takes away,
// and those it moves or turns.
export type BoardDiff = { added: PlacedPiece[]; removed: PlacedPiece[]; moved: MovedPiece[] }

export function boardDiff(from: PunctBoard, to: PunctBoard): BoardDiff {
    const before = new Map(from.pieces.map((piece) => [piece.id, piece]))
    const after = new Set(to.pieces.map((piece) => piece.id))
    const added: PlacedPiece[] = []
    const moved: MovedPiece[] = []
    for (const piece of to.pieces) {
        const was = before.get(piece.id)
        if (was === undefined) added.push(piece)
        else if (!samePlace(was, piece)) moved.push({ was, piece })
    }
    const removed = from.pieces.filter((piece) => !after.has(piece.id))
    return { added, removed, moved }
}

export function isUnchanged(diff: BoardDiff): boolean {
    return diff.added.length === 0 && diff.removed.length === 0 && diff.moved.length === 0
}

function samePlace(a: PlacedPiece, b: PlacedPiece): boolean {
    return sameCoordinates(a.punct, b.punct) && a.rotation === b.rotation && a.level === b.level
}

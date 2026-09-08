import { isCube, type Barrier, type Cube } from '@tabletop/estates'

export function placementPieceKey(piece: Cube | Barrier): string {
    return isCube(piece) ? `cube:${piece.company}:${piece.value}` : `barrier:${piece.value}`
}

export function withPlacementPreview<T extends Cube | Barrier>(pieces: T[], preview?: T): T[] {
    if (
        !preview ||
        pieces.some((piece) => placementPieceKey(piece) === placementPieceKey(preview))
    ) {
        return pieces
    }
    return [...pieces, preview]
}

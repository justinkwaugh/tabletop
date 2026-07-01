import { SantiagoBoard, CropType, SquareType, CanalSegment, isFieldSquare } from '../model/board.js'
import { isConnectedToSpring, isCanalPlaced } from './irrigation.js'

// Returns true when (col, row) is a valid spot to plant — any empty square is valid.
export function isValidFieldPlacement(
    board: SantiagoBoard,
    col: number,
    row: number,
    _playerId: string,
    _crop: CropType
): boolean {
    if (col < 0 || col >= 8 || row < 0 || row >= 6) return false
    return board.squares[col][row].type === SquareType.Empty
}

// Returns true if the given canal segment is a legal placement:
// it must not already be placed and must connect to the spring network.
export function isPlaceableSegment(board: SantiagoBoard, segment: CanalSegment): boolean {
    return !isCanalPlaced(board, segment) && isConnectedToSpring(board, segment)
}

// Returns valid squares for the neutral tile in 3-player games.
// Rule: must be adjacent to any existing field or desert. Falls back to any empty square
// if no fields have been placed yet (first round, round 1 edge case).
export function validNeutralTilePlacements(board: SantiagoBoard): { col: number; row: number }[] {
    const adjacent: { col: number; row: number }[] = []
    const anyEmpty: { col: number; row: number }[] = []

    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 6; row++) {
            if (board.squares[col][row].type !== SquareType.Empty) continue
            anyEmpty.push({ col, row })
            for (const [nc, nr] of [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]] as [number, number][]) {
                if (nc < 0 || nc >= 8 || nr < 0 || nr >= 6) continue
                if (isFieldSquare(board.squares[nc][nr])) { adjacent.push({ col, row }); break }
            }
        }
    }

    return adjacent.length > 0 ? adjacent : anyEmpty
}

// Returns all canal segments that are unplaced and connected to the spring.
export function validCanalPlacements(board: SantiagoBoard): CanalSegment[] {
    const segments: CanalSegment[] = []
    for (let col = 0; col <= 3; col++) {
        for (let row = 0; row <= 3; row++) {
            const seg: CanalSegment = { orientation: 'H', col, row }
            if (!isCanalPlaced(board, seg) && isConnectedToSpring(board, seg)) segments.push(seg)
        }
    }
    for (let col = 0; col <= 4; col++) {
        for (let row = 0; row <= 2; row++) {
            const seg: CanalSegment = { orientation: 'V', col, row }
            if (!isCanalPlaced(board, seg) && isConnectedToSpring(board, seg)) segments.push(seg)
        }
    }
    return segments
}

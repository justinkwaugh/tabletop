import { SantiagoBoard, CropType, SquareType, CanalSegment } from '../model/board.js'
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

import * as Type from 'typebox'
import { PieceOwner } from './owner.js'

export enum SquareType {
    Blank = 'blank',
    Forest = 'forest',
    Hill = 'hill',
    Village = 'village'
}

// A single square on the board. knightOwner/castleOwner are set if a knight or castle
// (belonging to a player, or to the neutral prince) occupies it.
// regionId points at whichever Region (owned or neutral) currently contains this square.
export type BoardSquare = Type.Static<typeof BoardSquare>
export const BoardSquare = Type.Object({
    type: Type.Enum(SquareType),
    knightOwner: Type.Optional(PieceOwner),
    castleOwner: Type.Optional(PieceOwner),
    regionId: Type.Optional(Type.String())
})

// Only north/west are ever stored - see wallBetween() below for why.
export enum WallEdge {
    North = 'north',
    West = 'west'
}

// A boundary wall placed on one edge of a square. Walls are neutral - not owned by any
// color. The outer edge of the whole board is always implicitly walled and is never
// stored here (see isWalledBetween).
export type Wall = Type.Static<typeof Wall>
export const Wall = Type.Object({
    col: Type.Number(),
    row: Type.Number(),
    edge: Type.Enum(WallEdge)
})

// The 6 physical tiles (5x5 each) arrange into a 3-wide x 2-tall grid of tiles, so the
// assembled board is 15 columns x 10 rows. squares[row][col].
export const BOARD_COLS = 15
export const BOARD_ROWS = 10

export type BoardTileId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export const BoardTileIdSchema = Type.Union([
    Type.Literal('A'),
    Type.Literal('B'),
    Type.Literal('C'),
    Type.Literal('D'),
    Type.Literal('E'),
    Type.Literal('F')
])

export type TileRotation = 0 | 90 | 180 | 270
export const TileRotationSchema = Type.Union([
    Type.Literal(0),
    Type.Literal(90),
    Type.Literal(180),
    Type.Literal(270)
])

// Which physical tile (and rotation) landed in each of the 6 slots of the 3x2 tile
// grid, so the UI can render the actual board art instead of re-deriving it (which
// isn't reliably possible - different tiles/rotations can produce identical terrain
// patterns). Populated by assembleBoard() for real games; omitted entirely by
// synthetic test boards, which don't care about visual tile identity.
export type TileLayout = Type.Static<typeof TileLayout>
export const TileLayout = Type.Object({
    tileId: BoardTileIdSchema,
    tileCol: Type.Number(),
    tileRow: Type.Number(),
    rotation: TileRotationSchema
})

export type LowenherzBoard = Type.Static<typeof LowenherzBoard>
export const LowenherzBoard = Type.Object({
    squares: Type.Array(Type.Array(BoardSquare)),
    walls: Type.Array(Wall),
    tileLayout: Type.Optional(Type.Array(TileLayout))
})

export function squareKey(col: number, row: number): string {
    return `${col},${row}`
}

// The plain average of a region's own squares - not its castle, and not clamped to an
// actual square, since the only consumer (ScorePopupAnimator's floating "+N"/"-N") just
// wants a point to float the popup over, and an irregular region's castle can sit at one
// edge of it rather than where the region actually reads as "the middle".
export function regionCentroidSquareKey(squareKeys: string[]): string {
    const points = squareKeys.map((key) => key.split(',').map(Number) as [number, number])
    const col = points.reduce((sum, [c]) => sum + c, 0) / points.length
    const row = points.reduce((sum, [, r]) => sum + r, 0) / points.length
    return squareKey(col, row)
}

export function isOnBoard(col: number, row: number): boolean {
    return col >= 0 && col < BOARD_COLS && row >= 0 && row < BOARD_ROWS
}

export function getSquare(board: LowenherzBoard, col: number, row: number): BoardSquare | undefined {
    return board.squares[row]?.[col]
}

// Canonicalizes the edge between two orthogonally-adjacent squares. A wall is always
// stored from the perspective of the higher-index square (so the wall "north of (c,r)"
// is the same wall as "south of (c,r-1)", stored once as {col:c, row:r, edge:north}).
// Returns undefined if the two squares aren't orthogonally adjacent.
export function wallBetween(
    colA: number,
    rowA: number,
    colB: number,
    rowB: number
): Wall | undefined {
    if (colA === colB && Math.abs(rowA - rowB) === 1) {
        const lowerRow = Math.max(rowA, rowB)
        return { col: colA, row: lowerRow, edge: WallEdge.North }
    }
    if (rowA === rowB && Math.abs(colA - colB) === 1) {
        const higherCol = Math.max(colA, colB)
        return { col: higherCol, row: rowA, edge: WallEdge.West }
    }
    return undefined
}

function wallsEqual(a: Wall, b: Wall): boolean {
    return a.col === b.col && a.row === b.row && a.edge === b.edge
}

// True if a boundary wall separates two orthogonally-adjacent squares - either an
// explicitly-placed wall, or because one of the two squares is off the board entirely
// (the board's outer edge is always an implicit wall).
export function isWalledBetween(
    board: LowenherzBoard,
    colA: number,
    rowA: number,
    colB: number,
    rowB: number
): boolean {
    if (!isOnBoard(colA, rowA) || !isOnBoard(colB, rowB)) return true

    const wall = wallBetween(colA, rowA, colB, rowB)
    if (!wall) return true // not adjacent at all - treat as walled off

    return board.walls.some((w) => wallsEqual(w, wall))
}

// The 4 orthogonal neighbor coordinates of a square (may be off-board).
export function neighbors(col: number, row: number): { col: number; row: number }[] {
    return [
        { col, row: row - 1 },
        { col, row: row + 1 },
        { col: col - 1, row },
        { col: col + 1, row }
    ]
}

export function manhattanDistance(colA: number, rowA: number, colB: number, rowB: number): number {
    return Math.abs(colA - colB) + Math.abs(rowA - rowB)
}

// All (col, row) coordinates on the board that currently hold a castle belonging to the
// given owner (a player or the neutral prince).
export function castleSquaresForOwner(
    board: LowenherzBoard,
    owner: PieceOwner
): { col: number; row: number }[] {
    const result: { col: number; row: number }[] = []
    for (let row = 0; row < board.squares.length; row++) {
        for (let col = 0; col < board.squares[row].length; col++) {
            if (board.squares[row][col].castleOwner === owner) {
                result.push({ col, row })
            }
        }
    }
    return result
}

// "Boundary walls may never be placed between a knight and a castle of the same prince or
// between two knights of the same prince." True when a wall on the edge between these two
// squares would do exactly that. Shared so the rule has one definition: PlaceWall rejects
// such a wall outright, and ExpandRegion skips it when ringing a newly claimed square
// (which can legally hold the expanding player's own knight).
export function separatesSamePrincePieces(
    square1: BoardSquare | undefined,
    square2: BoardSquare | undefined
): boolean {
    if (!square1 || !square2) return false
    if (square1.knightOwner && square1.knightOwner === square2.knightOwner) return true
    if (square1.knightOwner && square1.knightOwner === square2.castleOwner) return true
    if (square2.knightOwner && square2.knightOwner === square1.castleOwner) return true
    return false
}

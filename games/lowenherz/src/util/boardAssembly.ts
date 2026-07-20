import { Prng, shuffle } from '@tabletop/common'
import { BoardTiles, type BoardTile } from '../definition/boardTiles.js'
import { BOARD_COLS, BOARD_ROWS, type BoardSquare, type LowenherzBoard, SquareType } from '../model/board.js'

const TILE_SIZE = 5

// Rotates a square grid 90 degrees clockwise.
function rotate90<T>(grid: T[][]): T[][] {
    const n = grid.length
    const result: T[][] = Array.from({ length: n }, () => new Array(n))
    for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
            result[col][n - 1 - row] = grid[row][col]
        }
    }
    return result
}

function rotateGrid<T>(grid: T[][], degrees: 0 | 90 | 180 | 270): T[][] {
    let result = grid
    for (let i = 0; i < degrees / 90; i++) {
        result = rotate90(result)
    }
    return result
}

// Variable-construction setup: shuffle the 6 tiles, give each a random rotation, and
// arrange them in a 3-wide x 2-tall grid (order and orientation don't matter per the
// rules). Uses the game's own seeded Prng so the assembled board is part of replayable
// game state, rather than the purely-decorative per-client shuffle the UI used before
// real game state existed.
export function assembleBoard(prng: Prng): LowenherzBoard {
    const tiles: BoardTile[] = [...BoardTiles]
    shuffle(tiles, prng.random)

    const tilePositions = [
        { tileCol: 0, tileRow: 0 },
        { tileCol: 1, tileRow: 0 },
        { tileCol: 2, tileRow: 0 },
        { tileCol: 0, tileRow: 1 },
        { tileCol: 1, tileRow: 1 },
        { tileCol: 2, tileRow: 1 }
    ]

    const squares: BoardSquare[][] = Array.from({ length: BOARD_ROWS }, () =>
        Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
    )

    const rotations = [0, 90, 180, 270] as const

    tiles.forEach((tile, index) => {
        const rotation = rotations[prng.randInt(rotations.length)]
        const rotatedSquares = rotateGrid(tile.squares, rotation)
        const { tileCol, tileRow } = tilePositions[index]

        for (let r = 0; r < TILE_SIZE; r++) {
            for (let c = 0; c < TILE_SIZE; c++) {
                const globalRow = tileRow * TILE_SIZE + r
                const globalCol = tileCol * TILE_SIZE + c
                squares[globalRow][globalCol] = { type: rotatedSquares[r][c] }
            }
        }
    })

    return { squares, walls: [] }
}

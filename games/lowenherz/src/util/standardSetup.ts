import { Color } from '@tabletop/common'
import { BoardTiles } from '../definition/boardTiles.js'
import {
    BOARD_COLS,
    BOARD_ROWS,
    LowenherzBoard,
    SquareType,
    Wall,
    WallEdge
} from '../model/board.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { detectNewRegions } from './regionDetection.js'
import { removeInteriorWalls, scoreRegion } from './regionScoring.js'

const TILE_SIZE = 5

// The "basic game" board is always laid out the same way - tiles read A B C / D E F,
// top-left to bottom-right, each at its printed (unrotated) orientation. Only the
// variable-construction rules mix and rotate the tiles randomly (see assembleBoard()).
const STANDARD_TILE_ORDER: { id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; tileCol: number; tileRow: number }[] = [
    { id: 'A', tileCol: 0, tileRow: 0 },
    { id: 'B', tileCol: 1, tileRow: 0 },
    { id: 'C', tileCol: 2, tileRow: 0 },
    { id: 'D', tileCol: 0, tileRow: 1 },
    { id: 'E', tileCol: 1, tileRow: 1 },
    { id: 'F', tileCol: 2, tileRow: 1 }
]

// The four corner starting regions from the rulebook's "Overview & layout for the
// basic game" diagram, transcribed square-by-square and cross-checked against the
// known terrain of each tile (every castle/knight square below is Blank, every
// castle-knight pair is orthogonally adjacent, and the four wall rectangles don't
// overlap). ownerRect is the boundary-walled rectangle enclosing that color's one
// starting region; extraCastles/extraKnights are the other two castle+knight pairs
// each prince starts with, sitting unenclosed in contested territory (per "each prince
// has three castles, but only one has the stable boundaries...").
type CornerSetup = {
    color: Color
    ownerRect: { colMin: number; colMax: number; rowMin: number; rowMax: number }
    ownerCastle: { col: number; row: number }
    ownerKnight: { col: number; row: number }
    extraCastles: { col: number; row: number }[]
    extraKnights: { col: number; row: number }[]
}

const CORNER_SETUPS: CornerSetup[] = [
    {
        color: Color.Pink,
        ownerRect: { colMin: 0, colMax: 2, rowMin: 0, rowMax: 1 },
        ownerCastle: { col: 0, row: 0 },
        ownerKnight: { col: 0, row: 1 },
        extraCastles: [
            { col: 12, row: 3 },
            { col: 3, row: 9 }
        ],
        extraKnights: [
            { col: 12, row: 4 },
            { col: 2, row: 9 }
        ]
    },
    {
        color: Color.Yellow,
        ownerRect: { colMin: 0, colMax: 1, rowMin: 7, rowMax: 9 },
        ownerCastle: { col: 0, row: 8 },
        ownerKnight: { col: 0, row: 7 },
        extraCastles: [
            { col: 8, row: 0 },
            { col: 11, row: 6 }
        ],
        extraKnights: [
            { col: 8, row: 1 },
            { col: 11, row: 5 }
        ]
    },
    {
        color: Color.Purple,
        ownerRect: { colMin: 12, colMax: 14, rowMin: 0, rowMax: 1 },
        ownerCastle: { col: 13, row: 1 },
        ownerKnight: { col: 14, row: 1 },
        extraCastles: [
            { col: 3, row: 2 },
            { col: 6, row: 7 }
        ],
        extraKnights: [
            { col: 3, row: 3 },
            { col: 6, row: 6 }
        ]
    },
    {
        color: Color.Gray,
        ownerRect: { colMin: 13, colMax: 14, rowMin: 7, rowMax: 9 },
        ownerCastle: { col: 13, row: 9 },
        ownerKnight: { col: 14, row: 9 },
        extraCastles: [
            { col: 1, row: 4 },
            { col: 9, row: 3 }
        ],
        extraKnights: [
            { col: 0, row: 4 },
            { col: 8, row: 3 }
        ]
    }
]

// All the walls needed to fully enclose one rectangle - the board's own outer edge is
// already an implicit wall (see isWalledBetween) and is never stored, so an edge of the
// rectangle that lies on the board boundary is simply skipped.
function rectangleWalls(rect: { colMin: number; colMax: number; rowMin: number; rowMax: number }): Wall[] {
    const walls: Wall[] = []
    const { colMin, colMax, rowMin, rowMax } = rect

    for (let col = colMin; col <= colMax; col++) {
        if (rowMin > 0) walls.push({ col, row: rowMin, edge: WallEdge.North })
        if (rowMax < BOARD_ROWS - 1) walls.push({ col, row: rowMax + 1, edge: WallEdge.North })
    }
    for (let row = rowMin; row <= rowMax; row++) {
        if (colMin > 0) walls.push({ col: colMin, row, edge: WallEdge.West })
        if (colMax < BOARD_COLS - 1) walls.push({ col: colMax + 1, row, edge: WallEdge.West })
    }

    return walls
}

// The fixed board for the basic game - same 6 tiles as variable construction, but
// always in the same order/orientation rather than shuffled and rotated (see
// assembleBoard()).
export function assembleStandardBoard(): LowenherzBoard {
    const squares: LowenherzBoard['squares'] = Array.from({ length: BOARD_ROWS }, () =>
        Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
    )

    const tileLayout = STANDARD_TILE_ORDER.map(({ id, tileCol, tileRow }) => {
        const tile = BoardTiles.find((t) => t.id === id)!
        for (let r = 0; r < TILE_SIZE; r++) {
            for (let c = 0; c < TILE_SIZE; c++) {
                const globalRow = tileRow * TILE_SIZE + r
                const globalCol = tileCol * TILE_SIZE + c
                squares[globalRow][globalCol] = { type: tile.squares[r][c] }
            }
        }
        return { tileId: id, tileCol, tileRow, rotation: 0 as const }
    })

    return { squares, walls: [], tileLayout }
}

// Places every color's fixed castles/knights/walls (all four corners, regardless of
// how many are real players - an unclaimed color's pieces just sit there as neutral
// obstacles, same as the variable-construction setup's handling of a 3-player game's
// unused 4th color), then detects and scores the resulting starting regions exactly as
// PlaceWall would mid-game. Called once, right after the board itself is assembled.
export function applyStandardSetup(state: HydratedLowenherzGameState) {
    for (const corner of CORNER_SETUPS) {
        state.board.walls.push(...rectangleWalls(corner.ownerRect))

        const castles = [corner.ownerCastle, ...corner.extraCastles]
        const knights = [corner.ownerKnight, ...corner.extraKnights]
        for (const { col, row } of castles) {
            state.board.squares[row][col] = { ...state.board.squares[row][col], castleColor: corner.color }
        }
        for (const { col, row } of knights) {
            state.board.squares[row][col] = { ...state.board.squares[row][col], knightColor: corner.color }
        }

        const owner = state.players.find((p) => p.color === corner.color)
        if (owner) owner.knightsInStock -= castles.length
    }

    const newRegions = detectNewRegions(state.board, state.regions)
    for (const region of newRegions) {
        if (region.ownerColor) {
            const owner = state.players.find((p) => p.color === region.ownerColor)
            if (owner) owner.powerPoints += scoreRegion(region, state.board)
        }
        state.regions.push(region)
        removeInteriorWalls(state.board, region)
    }
}

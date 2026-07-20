// The terrain layout of each of the 6 physical board tiles, transcribed from the real
// board art. Squares are [row][col], row 0 = top and col 0 = left as printed on the
// tile (before any in-game rotation is applied during variable-construction setup).

import { SquareType } from '../model/board.js'

export type BoardTileId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export type BoardTile = {
    id: BoardTileId
    squares: SquareType[][]
}

const { Blank, Forest, Hill, Village } = SquareType

export const BoardTiles: BoardTile[] = [
    {
        id: 'A',
        squares: [
            [Blank, Forest, Blank, Forest, Forest],
            [Blank, Hill, Blank, Village, Forest],
            [Blank, Blank, Blank, Blank, Forest],
            [Forest, Village, Forest, Blank, Blank],
            [Blank, Blank, Blank, Hill, Hill]
        ]
    },
    {
        id: 'B',
        squares: [
            [Forest, Forest, Forest, Forest, Blank],
            [Forest, Hill, Forest, Blank, Hill],
            [Forest, Forest, Forest, Village, Blank],
            [Blank, Forest, Forest, Blank, Blank],
            [Hill, Hill, Forest, Hill, Hill]
        ]
    },
    {
        id: 'C',
        squares: [
            [Blank, Forest, Forest, Blank, Forest],
            [Forest, Village, Hill, Blank, Blank],
            [Blank, Forest, Blank, Blank, Forest],
            [Hill, Blank, Blank, Village, Forest],
            [Hill, Forest, Blank, Blank, Forest]
        ]
    },
    {
        id: 'D',
        squares: [
            [Forest, Village, Blank, Forest, Hill],
            [Blank, Blank, Blank, Blank, Hill],
            [Blank, Forest, Forest, Blank, Blank],
            [Blank, Hill, Hill, Blank, Village],
            [Blank, Forest, Blank, Blank, Forest]
        ]
    },
    {
        id: 'E',
        squares: [
            [Forest, Hill, Forest, Hill, Hill],
            [Blank, Blank, Village, Blank, Forest],
            [Forest, Blank, Forest, Blank, Village],
            [Forest, Blank, Hill, Forest, Blank],
            [Forest, Blank, Forest, Blank, Forest]
        ]
    },
    {
        id: 'F',
        squares: [
            [Hill, Blank, Blank, Blank, Blank],
            [Blank, Blank, Village, Blank, Forest],
            [Forest, Forest, Forest, Forest, Hill],
            [Forest, Blank, Hill, Forest, Blank],
            [Forest, Blank, Blank, Blank, Blank]
        ]
    }
]

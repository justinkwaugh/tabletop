import { assertExists, type OffsetCoordinates, sameCoordinates } from '@tabletop/common'
import * as Type from 'typebox'
import { CoralColor } from './colors.js'

export const ReefBoardIds = [1, 2, 3, 4] as const
export type ReefBoardId = (typeof ReefBoardIds)[number]
export const ReefBoardIdSchema = Type.Union([
    Type.Literal(1),
    Type.Literal(2),
    Type.Literal(3),
    Type.Literal(4)
])

export type StartingPolyp = {
    coords: OffsetCoordinates
    color: CoralColor
}

export type ReefBoard = {
    id: ReefBoardId
    rock: readonly OffsetCoordinates[]
    startingPolyps: readonly StartingPolyp[]
    extraGrowth: OffsetCoordinates
}

// The official board art, numbered as its files are (docs/board-map.md): six columns by seven rows,
// read top to bottom. '.' rock, '#' sand (open water in the art), ' ' off the board, '*' the
// extra-growth (starfish) square, and a letter for each starting polyp. Every board has 33 rock
// squares.
const BoardMaps: Record<ReefBoardId, readonly string[]> = {
    1: ['  ... ', '...W..', '..#.P.', '.G.*..', ' .Y.O.', ' ..#..', ' .... '],
    2: [' ...  ', '......', '.#G.Y.', '.O.*. ', '..#.P.', '...W..', ' ...  '],
    3: ['  ..  ', '......', '.P.W..', '..*#. ', ' G..O.', '..#Y..', '.... .'],
    4: ['  ....', '...#..', '..W.O.', '.Y.*#.', ' .#.P.', ' ..G..', '  ....']
}

const StartingPolypLetters: Record<string, CoralColor> = {
    G: CoralColor.Grey,
    O: CoralColor.Orange,
    P: CoralColor.Pink,
    W: CoralColor.White,
    Y: CoralColor.Yellow
}

const RockSymbols = new Set(['.', '*', ...Object.keys(StartingPolypLetters)])

function parseBoard(id: ReefBoardId): ReefBoard {
    const rock: OffsetCoordinates[] = []
    const startingPolyps: StartingPolyp[] = []
    let extraGrowth: OffsetCoordinates | undefined

    BoardMaps[id].forEach((line, row) => {
        ;[...line].forEach((symbol, col) => {
            const coords = { row, col }
            if (!RockSymbols.has(symbol)) {
                return
            }
            rock.push(coords)
            if (symbol === '*') {
                extraGrowth = coords
            }
            const color = StartingPolypLetters[symbol]
            if (color) {
                startingPolyps.push({ coords, color })
            }
        })
    })

    assertExists(extraGrowth, `Reef board ${id} has no extra-growth square`)
    return { id, rock, startingPolyps, extraGrowth }
}

export const ReefBoards: Record<ReefBoardId, ReefBoard> = {
    1: parseBoard(1),
    2: parseBoard(2),
    3: parseBoard(3),
    4: parseBoard(4)
}

export function isRock(boardId: ReefBoardId, coords: OffsetCoordinates): boolean {
    return ReefBoards[boardId].rock.some((square) => sameCoordinates(square, coords))
}

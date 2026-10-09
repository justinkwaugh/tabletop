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

// Transcribed square by square in docs/board-map.md and checked against a printed copy:
// '.' rock, '#' sand, ' ' off the board, '*' the extra-growth square, and a letter for
// each starting polyp. Every board has 33 rock squares.
const BoardMaps: Record<ReefBoardId, readonly string[]> = {
    1: ['.. ... ', '..G.P. ', '.#.*...', '.Y.#W..', ' .O... ', '... .. '],
    2: ['.......', '..O#P..', '.#.*.G.', '..W.#..', ' ..Y.. ', ' ...   '],
    3: [' .. .. ', ' .Y.P. ', '...*.W.', '..G.#..', '..#O...', ' ..... '],
    4: ['   ... ', '...G.. ', '..Y.#..', '.#.*.W.', '..O.P..', ' ..... ']
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

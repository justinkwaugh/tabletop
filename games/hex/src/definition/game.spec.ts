import { describe, expect, it } from 'vitest'
import { assert, Color, GameResult } from '@tabletop/common'
import { HexRuntime } from './runtime.js'
import {
    RedPlayer,
    redPlayerFromConfig,
    boardSizeFromConfig,
    swapRuleFromConfig
} from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import {
    HydratedHexGameState,
    HexGameStateValidator,
    type HexGameState
} from '../model/gameState.js'
import { HydratedHexBoard, type StoneColor } from '../model/board.js'
import { BoardSize, cellsPerSide } from '../model/boardSize.js'
import { cellName, Edge, gridOf } from '../model/cells.js'
import { isPlaceStone, type PlaceStone } from '../actions/placeStone.js'
import type { SwapColors } from '../actions/swapColors.js'
import {
    actionBase as base,
    createGame as createTestGame,
    engine,
    execute,
    legalActions,
    MASTER_SEED,
    playToEnd,
    type HexConfig,
    type HexGame
} from './tests/playthrough.js'

const R = 'red'
const B = 'blue'

function createGame(
    config: HexConfig = {},
    owner?: { ownerId: string; userIds: Record<string, string> }
) {
    return createTestGame(config, [R, B], owner)
}

function start(game: HexGame): HexGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [R, B] } }).initialState
}

function placeAction(game: HexGame, playerId: string, cell: string): PlaceStone {
    return { ...base(game, playerId), type: ActionType.PlaceStone, cell }
}

function swapAction(game: HexGame, playerId: string): SwapColors {
    return { ...base(game, playerId), type: ActionType.SwapColors }
}

const place = (game: HexGame, state: HexGameState, playerId: string, cell: string) =>
    execute(game, state, placeAction(game, playerId, cell))

function colorOf(state: HexGameState, playerId: string) {
    return state.players.find((player) => player.playerId === playerId)?.color
}

// The stones listed are on the board, and Red is to play.
function position(game: HexGame, red: string[], blue: string[]): HexGameState {
    const state = start(game)
    const of = (color: StoneColor) => (cell: string) => ({ cell, color })
    const stones = [...red.map(of(Color.Red)), ...blue.map(of(Color.Blue))]
    state.board.stones = stones.map((stone, id) => ({ id, ...stone }))
    return state
}

// Column C from row 1 to row `rows` of the 11 board.
const columnC = (rows: number) =>
    Array.from({ length: rows }, (_, row) => cellName({ column: 2, row }))

describe('The Hex boards', () => {
    const sizes = Object.values(BoardSize)

    it('hold a rhombus of cells, as many to a side as the board is named for', () => {
        expect(sizes.map(cellsPerSide)).toEqual([9, 11, 13, 14, 19])
        for (const size of sizes) {
            const side = cellsPerSide(size)
            const grid = gridOf(size)
            expect(grid.cells).toHaveLength(side * side)
            expect(new Set(grid.cells).size).toBe(grid.cells.length)
            for (const edge of Object.values(Edge)) {
                expect(grid.cells.filter((cell) => grid.edgesOf(cell).includes(edge))).toHaveLength(
                    side
                )
            }
            const last = String.fromCharCode('A'.charCodeAt(0) + side - 1)
            expect(grid.edgesOf('A1')).toEqual([Edge.Top, Edge.Left])
            expect(grid.edgesOf(`${last}1`)).toEqual([Edge.Top, Edge.Right])
            expect(grid.edgesOf(`A${side}`)).toEqual([Edge.Bottom, Edge.Left])
            expect(grid.edgesOf(`${last}${side}`)).toEqual([Edge.Bottom, Edge.Right])
        }
    })

    it('name cells as HexWiki does: column letter, then row number from the top', () => {
        const grid = gridOf(BoardSize.Eleven)
        expect(grid.cells.slice(0, 3)).toEqual(['A1', 'B1', 'C1'])
        expect(grid.cells.at(-1)).toBe('K11')
        expect(grid.cellOf('C2')).toEqual({ column: 2, row: 1 })
        expect(grid.neighborsOf('A1').toSorted()).toEqual(['A2', 'B1'])
        expect(grid.neighborsOf('B2').toSorted()).toEqual(['A2', 'A3', 'B1', 'B3', 'C1', 'C2'])
    })

    it('link every cell both ways: six inside, four on an edge, three or two in a corner', () => {
        for (const size of sizes) {
            const grid = gridOf(size)
            const last = grid.side - 1
            for (const cell of grid.cells) {
                const around = grid.neighborsOf(cell)
                const edges = grid.edgesOf(cell).length
                const { column, row } = grid.cellOf(cell)
                const acute = column + row === 0 || column + row === 2 * last
                expect(around).toHaveLength(edges === 0 ? 6 : edges === 1 ? 4 : acute ? 2 : 3)
                for (const neighbor of around) expect(grid.neighborsOf(neighbor)).toContain(cell)
            }
        }
    })

    it('always gives exactly one colour a winning chain on a full board', () => {
        let value = 11
        for (const size of sizes)
            for (let fill = 0; fill < 40; fill += 1) {
                const board = new HydratedHexBoard({ size, stones: [] })
                for (const cell of board.grid.cells) {
                    value = (value * 1103515245 + 12345) % 2147483648
                    board.place(cell, value % 2 === 0 ? Color.Red : Color.Blue)
                }
                const red = board.winningChainOf(Color.Red) !== undefined
                const blue = board.winningChainOf(Color.Blue) !== undefined
                expect(red !== blue).toBe(true)
            }
    })

    it('starts empty at the size chosen, and ends every random game with one winner', () => {
        for (const size of sizes) {
            const game = createGame({ size })
            const initial = start(game)
            expect(initial.board.size).toBe(size)
            for (let seed = 0; seed < 4; seed += 1) {
                const finished = playToEnd(game, initial, seed)
                expect(finished.result).toBe(GameResult.Win)
                expect(finished.winningPlayerIds).toHaveLength(1)
                assert(HexGameStateValidator.Check(finished), 'A finished game is canonical')
            }
        }
    })

    it('finds nothing off the board', () => {
        const board = new HydratedHexGameState(start(createGame({ size: BoardSize.Nine }))).board
        expect(board.isVacant('I9')).toBe(true)
        for (const cell of ['J1', 'A10', 'A0', 'a1', '', 'A1 ', 'A1.5', 'constructor']) {
            expect(board.isVacant(cell)).toBe(false)
        }
    })
})

describe('Hex', () => {
    it('starts with Red to play on an empty board, then alternates', () => {
        const game = createGame()
        let state = start(game)
        expect(state.activePlayerIds).toEqual([R])
        expect(colorOf(state, R)).toBe(Color.Red)
        expect(colorOf(state, B)).toBe(Color.Blue)
        expect(state.board).toEqual({ size: BoardSize.Eleven, stones: [] })
        state = place(game, state, R, 'F6')
        expect(state.activePlayerIds).toEqual([B])
        expect(state.board.stones).toEqual([{ id: 0, cell: 'F6', color: Color.Red }])
        state = place(game, state, B, 'G5')
        expect(state.activePlayerIds).toEqual([R])
        expect(state.board.stones[1]).toEqual({ id: 1, cell: 'G5', color: Color.Blue })
    })

    it('rejects a taken cell and anything that is not a cell', () => {
        const game = createGame()
        const state = place(game, start(game), R, 'F6')
        for (const cell of ['F6', 'L1', 'A12', 'A0', 'f6', '', 'constructor', '__proto__', 'F6 ']) {
            expect(() => place(game, state, B, cell)).toThrow()
        }
    })

    it('ends when Red joins top and bottom, and Red wins', () => {
        const game = createGame()
        const chain = columnC(11)
        const state = position(game, chain.slice(0, -1), [])
        const processed = engine.executeCanonicalAction({
            game,
            state,
            action: placeAction(game, R, 'C11')
        })
        const finished = processed.updatedState
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(finished.result).toBe(GameResult.Win)
        expect(finished.winningPlayerIds).toEqual([R])
        expect(finished.activePlayerIds).toEqual([])
        expect(HexRuntime.scoring?.finalScores(finished)).toEqual({ [R]: 1, [B]: 0 })
        const action = processed.processedActions[0]
        assert(isPlaceStone(action), 'The last action places a stone')
        expect(action.metadata?.joinsEdges).toBe(true)
        assert(HexGameStateValidator.Check(finished), 'The finished state is canonical')
    })

    it('counts a chain that zigzags through the diagonal links', () => {
        const game = createGame({ size: BoardSize.Nine })
        // Down and to the left: each row's cell touches the next row's cell one column left.
        const chain = Array.from({ length: 9 }, (_, row) => cellName({ column: 8 - row, row }))
        const state = place(game, position(game, chain.slice(0, -1), []), R, 'A9')
        expect(state.winningPlayerIds).toEqual([R])
    })

    it('ends when Blue joins left and right, and Blue wins', () => {
        const game = createGame()
        const row = Array.from({ length: 11 }, (_, column) => cellName({ column, row: 4 }))
        let state = position(game, ['A1'], row.slice(0, -1))
        state = place(game, state, R, 'B1')
        state = place(game, state, B, 'K5')
        expect(state.winningPlayerIds).toEqual([B])
    })

    it("does not end on a chain joining the other player's edges, or only one edge", () => {
        const game = createGame()
        const row = Array.from({ length: 11 }, (_, column) => cellName({ column, row: 4 }))
        const across = place(game, position(game, row.slice(0, -1), []), R, 'K5')
        expect(across.machineState).toBe(MachineState.PlacingStones)
        expect(across.activePlayerIds).toEqual([B])
        const halfway = place(game, position(game, columnC(5), []), R, 'C6')
        expect(halfway.machineState).toBe(MachineState.PlacingStones)
    })

    it('does not join cells that only meet at a corner', () => {
        // C1 and B3 lie in the same line down the board but do not touch.
        const game = createGame()
        const board = new HydratedHexGameState(position(game, ['C1', 'B3'], [])).board
        expect(board.chainAt('C1')).toEqual(['C1'])
    })

    it('ends every random game with one winner, the board never full without one', () => {
        for (const swapRule of [true, false]) {
            const game = createGame({ swapRule })
            for (let seed = 0; seed < 12; seed += 1) {
                const finished = playToEnd(game, start(game), seed)
                expect(finished.result).toBe(GameResult.Win)
                expect(finished.winningPlayerIds).toHaveLength(1)
                const board = new HydratedHexGameState(finished).board
                const winner = new HydratedHexGameState(finished).colorOf(
                    finished.winningPlayerIds[0]
                )
                expect(board.winningChainOf(winner)).toBeDefined()
                expect(finished.turnManager.series.length).toBeLessThanOrEqual(3)
                assert(HexGameStateValidator.Check(finished), 'A finished game is canonical')
            }
        }
    })

    it('plays the same game from the same seed', () => {
        const game = createGame()
        const outcome = () => {
            const initial = engine.startGame(game, { masterSeed: MASTER_SEED }).initialState
            const finished = playToEnd(game, initial, 3)
            return {
                board: finished.board,
                players: finished.players,
                winners: finished.winningPlayerIds,
                actions: finished.actionCount
            }
        }
        expect(outcome()).toEqual(outcome())
    })
})

describe('The swap rule', () => {
    it("lets Blue take Red's first stone: colours trade and the new Blue plays", () => {
        const game = createGame({ swapRule: true })
        let state = place(game, start(game), R, 'F6')
        state = execute(game, state, swapAction(game, B))
        expect(colorOf(state, B)).toBe(Color.Red)
        expect(colorOf(state, R)).toBe(Color.Blue)
        expect(state.board.stones).toEqual([{ id: 0, cell: 'F6', color: Color.Red }])
        expect(state.activePlayerIds).toEqual([R])
        state = place(game, state, R, 'G5')
        expect(state.board.stones[1].color).toBe(Color.Blue)
    })

    it('cannot be swapped back, nor taken once Blue places', () => {
        const game = createGame({ swapRule: true })
        const opened = place(game, start(game), R, 'F6')
        const swapped = execute(game, opened, swapAction(game, B))
        expect(() => execute(game, swapped, swapAction(game, R))).toThrow()
        const placed = place(game, opened, B, 'G5')
        expect(() => execute(game, placed, swapAction(game, R))).toThrow()
        expect(() => execute(game, start(game), swapAction(game, R))).toThrow()
    })

    it('is offered only to Blue on the second turn', () => {
        const game = createGame({ swapRule: true })
        const opening = start(game)
        const answer = place(game, opening, R, 'F6')
        const offersSwap = (state: HexGameState) =>
            legalActions(game, state).some((action) => action.type === ActionType.SwapColors)
        expect(offersSwap(opening)).toBe(false)
        expect(offersSwap(answer)).toBe(true)
        expect(offersSwap(place(game, answer, B, 'G5'))).toBe(false)
    })

    it('is not offered when the option is off', () => {
        const game = createGame({ swapRule: false })
        const state = place(game, start(game), R, 'F6')
        expect(() => execute(game, state, swapAction(game, B))).toThrow()
    })
})

describe('Choosing Red', () => {
    const owner = { ownerId: 'u-blue', userIds: { [R]: 'u-red', [B]: 'u-blue' } }
    const redOf = (game: HexGame, masterSeed?: string) => {
        const state = engine.startGame(game, masterSeed ? { masterSeed } : undefined).initialState
        return state.players.find((player) => player.color === Color.Red)?.playerId
    }

    it('gives Red to the creator or the opponent when asked', () => {
        expect(redOf(createGame({ redPlayer: RedPlayer.Creator }, owner))).toBe(B)
        expect(redOf(createGame({ redPlayer: RedPlayer.Opponent }, owner))).toBe(R)
    })

    it('draws Red at random otherwise, and when the creator does not play', () => {
        const unseated = { ownerId: 'nobody', userIds: { [R]: 'u-red', [B]: 'u-blue' } }
        for (const game of [
            createGame({ redPlayer: RedPlayer.Random }, owner),
            createGame({ redPlayer: RedPlayer.Creator }, unseated),
            createGame({ redPlayer: RedPlayer.Opponent }, unseated)
        ]) {
            const reds = new Set(
                Array.from({ length: 8 }, (_, seed) => redOf(game, `${seed + 1}`.padStart(32, '0')))
            )
            expect(reds).toEqual(new Set([R, B]))
        }
    })
})

describe('Config readers', () => {
    it('default a missing value, read a known one and throw on an unknown one', () => {
        expect(swapRuleFromConfig({})).toBe(true)
        expect(swapRuleFromConfig({ swapRule: false })).toBe(false)
        expect(() => swapRuleFromConfig({ swapRule: 'yes' })).toThrow()
        expect(redPlayerFromConfig({})).toBe(RedPlayer.Random)
        expect(redPlayerFromConfig({ redPlayer: RedPlayer.Creator })).toBe(RedPlayer.Creator)
        expect(() => redPlayerFromConfig({ redPlayer: 'Mallory' })).toThrow()
        expect(boardSizeFromConfig({})).toBe(BoardSize.Eleven)
        expect(boardSizeFromConfig({ size: BoardSize.Nineteen })).toBe(BoardSize.Nineteen)
        expect(() => boardSizeFromConfig({ size: 'Seven' })).toThrow()
    })
})

import { describe, expect, it } from 'vitest'
import { assert, Color, GameResult } from '@tabletop/common'
import { YRuntime } from './runtime.js'
import {
    BlackPlayer,
    blackPlayerFromConfig,
    boardShapeFromConfig,
    swapRuleFromConfig
} from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { HydratedYGameState, YGameStateValidator, type YGameState } from '../model/gameState.js'
import { HydratedYBoard, type StoneColor } from '../model/board.js'
import { neighborsOf, POINTS, rowOf, Side, sidesOf, TOP_CORNER } from '../model/points.js'
import { BoardShape } from '../model/boardShape.js'
import { gridOf, hexSizeOf } from '../model/grids.js'
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
    type YConfig,
    type YGame
} from './tests/playthrough.js'

const B = 'black'
const W = 'white'

function createGame(
    config: YConfig = {},
    owner?: { ownerId: string; userIds: Record<string, string> }
) {
    return createTestGame(config, [B, W], owner)
}

function start(game: YGame): YGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [B, W] } }).initialState
}

function placeAction(game: YGame, playerId: string, point: string): PlaceStone {
    return { ...base(game, playerId), type: ActionType.PlaceStone, point }
}

function swapAction(game: YGame, playerId: string): SwapColors {
    return { ...base(game, playerId), type: ActionType.SwapColors }
}

const place = (game: YGame, state: YGameState, playerId: string, point: string) =>
    execute(game, state, placeAction(game, playerId, point))

function colorOf(state: YGameState, playerId: string) {
    return state.players.find((player) => player.playerId === playerId)?.color
}

// The stones listed are on the board, and Black is to play.
function position(game: YGame, black: string[], white: string[]): YGameState {
    const state = start(game)
    const stones = [
        ...black.map((point) => ({ point, color: Color.Black })),
        ...white.map((point) => ({ point, color: Color.White }))
    ]
    state.board.stones = stones.map(({ point, color }, id) => ({
        id,
        point,
        color: color === Color.Black ? Color.Black : Color.White
    }))
    return state
}

// The shortest run of points from `from` to any point satisfying `reached`.
function pathTo(from: string, reached: (point: string) => boolean): string[] {
    const previous = new Map<string, string | undefined>([[from, undefined]])
    const queue = [from]
    for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
        if (reached(current)) {
            const path = [current]
            for (let step = previous.get(current); step !== undefined; step = previous.get(step)) {
                path.unshift(step)
            }
            return path
        }
        for (const neighbor of neighborsOf(current)) {
            if (!previous.has(neighbor)) {
                previous.set(neighbor, current)
                queue.push(neighbor)
            }
        }
    }
    throw Error(`No path from ${from}`)
}

describe('The Game of Y board', () => {
    it('has 93 points: 24 on the sides, 9 to a side, 3 pentads and 66 hexads', () => {
        expect(POINTS).toHaveLength(93)
        const degrees = POINTS.map((point) => neighborsOf(point).length)
        expect(degrees.filter((degree) => degree === 5)).toHaveLength(3)
        expect(degrees.filter((degree) => degree === 6)).toHaveLength(66)
        expect(POINTS.filter((point) => sidesOf(point).length > 0)).toHaveLength(24)
        for (const side of Object.values(Side)) {
            expect(POINTS.filter((point) => sidesOf(point).includes(side))).toHaveLength(9)
        }
    })

    it('counts each corner for both of its sides', () => {
        const corners = POINTS.filter((point) => sidesOf(point).length === 2)
        expect(corners.sort()).toEqual(['A1', TOP_CORNER, 'I1'].sort())
        expect(sidesOf('A1')).toEqual([Side.Bottom, Side.Left])
        expect(sidesOf(TOP_CORNER)).toEqual([Side.Left, Side.Right])
        expect(sidesOf('I1')).toEqual([Side.Bottom, Side.Right])
    })

    it('links every point both ways', () => {
        for (const point of POINTS) {
            for (const neighbor of neighborsOf(point)) {
                expect(neighborsOf(neighbor)).toContain(point)
            }
        }
    })

    it('always gives exactly one colour a Y on a full board, whichever the board', () => {
        let value = 11
        for (const shape of Object.values(BoardShape))
            for (let fill = 0; fill < 100; fill += 1) {
                const board = new HydratedYBoard({ shape, stones: [] })
                for (const point of board.grid.points) {
                    value = (value * 1103515245 + 12345) % 2147483648
                    const color: StoneColor = value % 2 === 0 ? Color.Black : Color.White
                    board.place(point, color)
                }
                const black = board.yChainOf(Color.Black) !== undefined
                const white = board.yChainOf(Color.White) !== undefined
                expect(black !== white).toBe(true)
            }
    })
})

describe('The hex boards', () => {
    const hexShapes = Object.values(BoardShape).filter((shape) => hexSizeOf(shape) !== undefined)

    it('hold a triangle of cells, as many to a side as the board is named for', () => {
        for (const shape of hexShapes) {
            const size = hexSizeOf(shape) ?? 0
            const grid = gridOf(shape)
            expect(grid.points).toHaveLength((size * (size + 1)) / 2)
            expect(new Set(grid.points).size).toBe(grid.points.length)
            for (const side of Object.values(Side)) {
                expect(
                    grid.points.filter((point) => grid.sidesOf(point).includes(side))
                ).toHaveLength(size)
            }
            const corners = grid.points.filter((point) => grid.sidesOf(point).length === 2)
            const last = String.fromCharCode('A'.charCodeAt(0) + size - 1)
            expect(corners.sort()).toEqual(['A1', `A${size}`, `${last}${size}`].sort())
            expect(grid.sidesOf('A1')).toEqual([Side.Bottom, Side.Left])
            expect(grid.sidesOf(`A${size}`)).toEqual([Side.Left, Side.Right])
            expect(grid.sidesOf(`${last}${size}`)).toEqual([Side.Bottom, Side.Right])
        }
    })

    it('name cells by their two lines, as on a Hex board', () => {
        const grid = gridOf(BoardShape.Hex9)
        // The bottom side runs A1, B2 … I9; the left side A1 … A9; the right side A9 … I9.
        expect(grid.points.filter((point) => grid.sidesOf(point).includes(Side.Bottom))).toEqual([
            'A1',
            'B2',
            'C3',
            'D4',
            'E5',
            'F6',
            'G7',
            'H8',
            'I9'
        ])
        expect(grid.neighborsOf('A1').toSorted()).toEqual(['A2', 'B2'])
        expect(grid.neighborsOf('B3').toSorted()).toEqual(['A2', 'A3', 'B2', 'B4', 'C3', 'C4'])
    })

    it('link every cell both ways, inner cells to six and corners to two', () => {
        for (const shape of hexShapes) {
            const grid = gridOf(shape)
            for (const point of grid.points) {
                const around = grid.neighborsOf(point)
                const sides = grid.sidesOf(point).length
                expect(around).toHaveLength(sides === 0 ? 6 : sides === 1 ? 4 : 2)
                for (const neighbor of around) expect(grid.neighborsOf(neighbor)).toContain(point)
            }
        }
    })

    it('start empty on the board chosen, and end every random game with one winner', () => {
        for (const shape of hexShapes) {
            const game = createGame({ board: shape })
            const initial = start(game)
            expect(initial.board.shape).toBe(shape)
            for (let seed = 0; seed < 4; seed += 1) {
                const finished = playToEnd(game, initial, seed)
                expect(finished.result).toBe(GameResult.Win)
                expect(finished.winningPlayerIds).toHaveLength(1)
                assert(YGameStateValidator.Check(finished), 'A finished game is canonical')
            }
        }
    })

    it('refuse a Kadon point that is not a cell', () => {
        const game = createGame({ board: BoardShape.Hex9 })
        expect(new HydratedYGameState(start(game)).board.isVacant('J2')).toBe(false)
        expect(new HydratedYGameState(start(game)).board.isVacant('B2')).toBe(true)
    })
})

describe('The Game of Y', () => {
    it('starts with Black to play on an empty board, then alternates', () => {
        const game = createGame()
        let state = start(game)
        expect(state.activePlayerIds).toEqual([B])
        expect(colorOf(state, B)).toBe(Color.Black)
        expect(state.board.stones).toEqual([])
        state = place(game, state, B, 'E5')
        expect(state.activePlayerIds).toEqual([W])
        expect(state.board.stones).toEqual([{ id: 0, point: 'E5', color: Color.Black }])
        state = place(game, state, W, 'F5')
        expect(state.activePlayerIds).toEqual([B])
        expect(state.board.stones[1]).toEqual({ id: 1, point: 'F5', color: Color.White })
    })

    it('rejects a taken point and anything that is not a point', () => {
        const game = createGame()
        const state = place(game, start(game), B, 'E5')
        for (const point of ['E5', 'N5', 'A10', 'a1', '', 'constructor', '__proto__', 'E5 ']) {
            expect(() => place(game, state, W, point)).toThrow()
        }
    })

    it('ends when a chain reaches all three sides, and the placer wins', () => {
        const game = createGame()
        const leftToRight = pathTo('A5', (point) => sidesOf(point).includes(Side.Right))
        const down = pathTo(leftToRight[Math.floor(leftToRight.length / 2)], (point) =>
            sidesOf(point).includes(Side.Bottom)
        )
        const chain = [...new Set([...leftToRight, ...down])]
        const last = down.at(-1)
        assert(last !== undefined, 'The path reaches the bottom')
        const state = position(
            game,
            chain.filter((point) => point !== last),
            []
        )
        const processed = engine.executeCanonicalAction({
            game,
            state,
            action: placeAction(game, B, last)
        })
        const finished = processed.updatedState
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(finished.result).toBe(GameResult.Win)
        expect(finished.winningPlayerIds).toEqual([B])
        expect(finished.activePlayerIds).toEqual([])
        expect(YRuntime.scoring?.finalScores(finished)).toEqual({ [B]: 1, [W]: 0 })
        const action = processed.processedActions[0]
        assert(isPlaceStone(action), 'The last action places a stone')
        expect(action.metadata?.formsY).toBe(true)
        assert(YGameStateValidator.Check(finished), 'The finished state is canonical')
    })

    it('does not end on a chain touching only two sides', () => {
        const game = createGame()
        const leftToRight = pathTo('A5', (point) => sidesOf(point).includes(Side.Right))
        const last = leftToRight.at(-1)
        assert(last !== undefined, 'The path reaches the right side')
        const state = place(game, position(game, leftToRight.slice(0, -1), []), B, last)
        expect(state.machineState).toBe(MachineState.PlacingStones)
        expect(state.activePlayerIds).toEqual([W])
    })

    it('wins with a chain from a corner to the opposite side', () => {
        const game = createGame()
        const chain = pathTo(TOP_CORNER, (point) => rowOf(point) === 1)
        const last = chain.at(-1)
        assert(last !== undefined, 'The chain reaches the bottom')
        const state = place(game, position(game, chain.slice(0, -1), []), B, last)
        expect(state.winningPlayerIds).toEqual([B])
    })

    it('ends every random game with one winner, the board never full without one', () => {
        for (const swapRule of [true, false]) {
            const game = createGame({ swapRule })
            for (let seed = 0; seed < 12; seed += 1) {
                const finished = playToEnd(game, start(game), seed)
                expect(finished.result).toBe(GameResult.Win)
                expect(finished.winningPlayerIds).toHaveLength(1)
                const board = new HydratedYGameState(finished).board
                const winnerColor = colorOf(finished, finished.winningPlayerIds[0])
                expect(winnerColor === Color.Black || winnerColor === Color.White).toBe(true)
                expect(
                    board.yChainOf(winnerColor === Color.Black ? Color.Black : Color.White)
                ).toBeDefined()
                expect(finished.turnManager.series.length).toBeLessThanOrEqual(3)
                assert(YGameStateValidator.Check(finished), 'A finished game is canonical')
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
    it("lets White take Black's first stone: colours trade and the new White plays", () => {
        const game = createGame({ swapRule: true })
        let state = place(game, start(game), B, 'E5')
        state = execute(game, state, swapAction(game, W))
        expect(colorOf(state, W)).toBe(Color.Black)
        expect(colorOf(state, B)).toBe(Color.White)
        expect(state.board.stones).toEqual([{ id: 0, point: 'E5', color: Color.Black }])
        expect(state.activePlayerIds).toEqual([B])
        state = place(game, state, B, 'F5')
        expect(state.board.stones[1].color).toBe(Color.White)
    })

    it('cannot be swapped back, nor taken once White places', () => {
        const game = createGame({ swapRule: true })
        const opened = place(game, start(game), B, 'E5')
        const swapped = execute(game, opened, swapAction(game, W))
        expect(() => execute(game, swapped, swapAction(game, B))).toThrow()
        const placed = place(game, opened, W, 'F5')
        expect(() => execute(game, placed, swapAction(game, B))).toThrow()
        expect(() => execute(game, start(game), swapAction(game, B))).toThrow()
    })

    it('is offered only to White on the second turn', () => {
        const game = createGame({ swapRule: true })
        const opening = start(game)
        const answer = place(game, opening, B, 'E5')
        const offersSwap = (state: YGameState) =>
            legalActions(game, state).some((action) => action.type === ActionType.SwapColors)
        expect(offersSwap(opening)).toBe(false)
        expect(offersSwap(answer)).toBe(true)
        expect(offersSwap(place(game, answer, W, 'F5'))).toBe(false)
    })

    it('is not offered when the option is off', () => {
        const game = createGame({ swapRule: false })
        const state = place(game, start(game), B, 'E5')
        expect(() => execute(game, state, swapAction(game, W))).toThrow()
    })
})

describe('Choosing Black', () => {
    const owner = { ownerId: 'u-white', userIds: { [B]: 'u-black', [W]: 'u-white' } }
    const blackOf = (game: YGame, masterSeed?: string) => {
        const state = engine.startGame(game, masterSeed ? { masterSeed } : undefined).initialState
        return state.players.find((player) => player.color === Color.Black)?.playerId
    }

    it('gives Black to the creator or the opponent when asked', () => {
        expect(blackOf(createGame({ blackPlayer: BlackPlayer.Creator }, owner))).toBe(W)
        expect(blackOf(createGame({ blackPlayer: BlackPlayer.Opponent }, owner))).toBe(B)
    })

    it('draws Black at random otherwise, and when the creator does not play', () => {
        const unseated = { ownerId: 'nobody', userIds: { [B]: 'u-black', [W]: 'u-white' } }
        for (const game of [
            createGame({ blackPlayer: BlackPlayer.Random }, owner),
            createGame({ blackPlayer: BlackPlayer.Creator }, unseated),
            createGame({ blackPlayer: BlackPlayer.Opponent }, unseated)
        ]) {
            const blacks = new Set(
                Array.from({ length: 8 }, (_, seed) =>
                    blackOf(game, `${seed + 1}`.padStart(32, '0'))
                )
            )
            expect(blacks).toEqual(new Set([B, W]))
        }
    })
})

describe('Config readers', () => {
    it('default a missing value, read a known one and throw on an unknown one', () => {
        expect(swapRuleFromConfig({})).toBe(true)
        expect(swapRuleFromConfig({ swapRule: false })).toBe(false)
        expect(() => swapRuleFromConfig({ swapRule: 'yes' })).toThrow()
        expect(blackPlayerFromConfig({})).toBe(BlackPlayer.Random)
        expect(blackPlayerFromConfig({ blackPlayer: BlackPlayer.Creator })).toBe(
            BlackPlayer.Creator
        )
        expect(() => blackPlayerFromConfig({ blackPlayer: 'Mallory' })).toThrow()
        expect(boardShapeFromConfig({})).toBe(BoardShape.Kadon)
        expect(boardShapeFromConfig({ board: BoardShape.Hex13 })).toBe(BoardShape.Hex13)
        expect(() => boardShapeFromConfig({ board: 'Hex7' })).toThrow()
    })
})

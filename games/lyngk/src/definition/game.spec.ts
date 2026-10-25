import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    GameResult,
    PlayerStatus,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import { Definition } from './definition.js'
import { LyngkRuntime } from './runtime.js'
import { LyngkInfo } from './info.js'
import { LyngkVariant } from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { EndReason, HydratedLyngkGameState, type LyngkGameState } from '../model/gameState.js'
import { emptyBoard } from '../model/board.js'
import { POINTS } from '../model/geometry.js'
import { ACTIVE_COLORS, PieceColor } from '../model/pieces.js'
import type { ClaimColor } from '../actions/claimColor.js'
import type { MoveStack } from '../actions/moveStack.js'

const engine = new GameEngine(LyngkRuntime)
const A = 'alice'
const B = 'bob'
const { Ivory: I, Blue: U, Red: R, Green: G, Black: K, Joker: J } = PieceColor

function createGame(variant: LyngkVariant = LyngkVariant.Standard) {
    return LyngkRuntime.initializer.initializeGame(
        {
            id: 'lyngk-test',
            typeId: 'lyngk',
            ownerId: 'owner',
            seed: 5,
            config: { ...defaultGameConfig(LyngkInfo.configurator?.options ?? []), variant },
            players: [A, B].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

type LyngkGame = ReturnType<typeof createGame>

function start(game: LyngkGame): LyngkGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [A, B] } }).initialState
}

let counter = 0
function base(game: LyngkGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

function execute(game: LyngkGame, state: LyngkGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

function claimAction(game: LyngkGame, playerId: string, color: PieceColor): ClaimColor {
    return { ...base(game, playerId), type: ActionType.ClaimColor, color }
}

function moveAction(
    game: LyngkGame,
    playerId: string,
    from: AxialCoordinates,
    to: AxialCoordinates,
    via: AxialCoordinates[] = []
): MoveStack {
    return { ...base(game, playerId), type: ActionType.MoveStack, from, via, to }
}

function claim(game: LyngkGame, state: LyngkGameState, playerId: string, color: PieceColor) {
    return execute(game, state, claimAction(game, playerId, color))
}

function move(
    game: LyngkGame,
    state: LyngkGameState,
    playerId: string,
    from: AxialCoordinates,
    to: AxialCoordinates,
    via: AxialCoordinates[] = []
) {
    return execute(game, state, moveAction(game, playerId, from, to, via))
}

function rejects(game: LyngkGame, state: LyngkGameState, action: GameAction) {
    expect(() => execute(game, state, action)).toThrow()
}

// The centre column runs from c(-3) at the top to c(3) at the bottom.
const c = (r: number): AxialCoordinates => ({ q: 0, r })
const right = (r: number): AxialCoordinates => ({ q: 1, r })

function withStacks(
    state: LyngkGameState,
    stacks: [AxialCoordinates, PieceColor[]][],
    claims: Record<string, PieceColor[]> = {}
): LyngkGameState {
    const next = structuredClone(state)
    next.board = emptyBoard()
    for (const [coords, stack] of stacks) {
        const point = next.board.points.find(
            (p) => p.coords.q === coords.q && p.coords.r === coords.r
        )
        if (point === undefined) throw Error('not a point')
        point.stack = stack
    }
    for (const player of next.players) {
        player.claimed = claims[player.playerId] ?? []
    }
    return next
}

const stackAt = (state: LyngkGameState, coords: AxialCoordinates) =>
    new HydratedLyngkGameState(state).board.stackAt(coords)

describe('board', () => {
    it('has 43 points in columns of 1, 4, 7, 6, 7, 6, 7, 4, 1', () => {
        expect(POINTS).toHaveLength(43)
        const columns = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(
            (q) => POINTS.filter((point) => point.q === q).length
        )
        expect(columns).toEqual([1, 4, 7, 6, 7, 6, 7, 4, 1])
    })

    it('starts with 8 of each color and 3 jokers, one on every point', () => {
        const state = start(createGame())
        const pieces = state.board.points.flatMap((point) => point.stack)
        expect(state.board.points.every((point) => point.stack.length === 1)).toBe(true)
        for (const color of ACTIVE_COLORS) {
            expect(pieces.filter((piece) => piece === color)).toHaveLength(8)
        }
        expect(pieces.filter((piece) => piece === J)).toHaveLength(3)
        expect(state.activePlayerIds).toEqual([A])
    })
})

// Gives each piece an identity, counting up from the bottom of each stack in turn.
function numbered(state: LyngkGameState): LyngkGameState {
    let next = 0
    for (const point of state.board.points) {
        point.ids = point.stack.map(() => next++)
    }
    return state
}

const idsAt = (state: LyngkGameState, coords: AxialCoordinates) =>
    new HydratedLyngkGameState(state).board.idsAt(coords)

describe('piece identities', () => {
    it('names each piece by the point it was dealt to', () => {
        const state = start(createGame())
        expect(state.board.points.map((point) => point.ids)).toEqual(
            state.board.points.map((_, index) => [index])
        )
    })

    it('carries the moved pieces onto the stack they land on', () => {
        const game = createGame()
        const state = numbered(
            withStacks(start(game), [
                [c(-3), [I]],
                [c(0), [U]]
            ])
        )
        const [moving, target] = [idsAt(state, c(-3))!, idsAt(state, c(0))!]
        const moved = move(game, state, A, c(-3), c(0))
        expect(idsAt(moved, c(0))).toEqual([...target, ...moving])
        expect(idsAt(moved, c(-3))).toBeUndefined()
    })

    it('leaves them out where the stack landed on has none', () => {
        const game = createGame()
        const state = withStacks(start(game), [
            [c(-3), [I]],
            [c(0), [U]]
        ])
        state.board.points.find((point) => point.coords.r === -3 && point.coords.q === 0)!.ids = [7]
        expect(idsAt(move(game, state, A, c(-3), c(0)), c(0))).toBeUndefined()
    })

    it('takes them off the board with a scored stack', () => {
        const game = createGame()
        const state = numbered(
            withStacks(
                start(game),
                [
                    [c(0), [I]],
                    [c(1), [U, R, G, K]]
                ],
                { [A]: [I] }
            )
        )
        expect(idsAt(move(game, state, A, c(0), c(1)), c(1))).toBeUndefined()
    })
})

describe('moves', () => {
    it('moves to an adjacent piece or along a line over empty points, never over a piece', () => {
        const game = createGame()
        const state = withStacks(start(game), [
            [c(-3), [I]],
            [c(0), [U]],
            [c(1), [R]],
            [c(3), [G]]
        ])
        const jumped = move(game, state, A, c(-3), c(0))
        expect(stackAt(jumped, c(0))).toEqual([U, I])
        rejects(game, state, moveAction(game, A, c(-3), c(1)))
        expect(stackAt(move(game, state, A, c(1), c(3)), c(3))).toEqual([G, R])
    })

    it('lets a neutral single land only on a single', () => {
        const game = createGame()
        const state = withStacks(start(game), [
            [c(0), [I]],
            [c(1), [U, R]],
            [c(-1), [G]]
        ])
        rejects(game, state, moveAction(game, A, c(0), c(1)))
        expect(stackAt(move(game, state, A, c(0), c(-1)), c(-1))).toEqual([G, I])
    })

    it('lets a neutral stack land on a stack no higher than itself', () => {
        const game = createGame()
        const state = withStacks(start(game), [
            [c(0), [I, U]],
            [c(1), [R, G]],
            [c(-1), [K, R, G]]
        ])
        expect(stackAt(move(game, state, A, c(0), c(1)), c(1))).toEqual([R, G, I, U])
        rejects(game, state, moveAction(game, A, c(0), c(-1)))
    })

    it('lets a claimed color land on any higher stack', () => {
        const game = createGame()
        const state = withStacks(
            start(game),
            [
                [c(0), [I]],
                [c(1), [U, R, G]]
            ],
            { [A]: [I] }
        )
        expect(stackAt(move(game, state, A, c(0), c(1)), c(1))).toEqual([U, R, G, I])
    })

    it('never repeats a color in a stack, while jokers may share one', () => {
        const game = createGame()
        const state = withStacks(
            start(game),
            [
                [c(-1), [I]],
                [c(0), [U, I, G]],
                [c(1), [J, U]],
                [c(2), [J, R]]
            ],
            { [A]: [I] }
        )
        rejects(game, state, moveAction(game, A, c(-1), c(0)))
        expect(stackAt(move(game, state, A, c(1), c(2)), c(2))).toEqual([J, R, J, U])
    })

    it('never moves a joker on its own or a stack topped by an opponent color', () => {
        const game = createGame()
        const state = withStacks(
            start(game),
            [
                [c(0), [J]],
                [c(1), [R]],
                [c(2), [U]]
            ],
            {
                [B]: [R]
            }
        )
        rejects(game, state, moveAction(game, A, c(0), c(1)))
        rejects(game, state, moveAction(game, A, c(1), c(2)))
    })
})

describe('claims', () => {
    it('claims one color before moving, and the opponent may no longer move it', () => {
        const game = createGame()
        let state = withStacks(start(game), [
            [c(-1), [I]],
            [c(0), [R]],
            [c(1), [U]],
            [c(3), [G]]
        ])
        state = claim(game, state, A, R)
        expect(state.activePlayerIds).toEqual([A])
        rejects(game, state, claimAction(game, A, U))
        state = move(game, state, A, c(1), c(3))
        expect(state.players[0].claimed).toEqual([R])
        rejects(game, state, moveAction(game, B, c(0), c(-1)))
    })

    it('allows at most two claims each', () => {
        const game = createGame()
        const state = withStacks(
            start(game),
            [
                [c(0), [R]],
                [c(1), [U]],
                [c(2), [G]]
            ],
            {
                [A]: [I, K]
            }
        )
        rejects(game, state, claimAction(game, A, R))
    })
})

describe('stacks of five', () => {
    it('removes a completed stack with a claimed top and scores it', () => {
        const game = createGame()
        let state = withStacks(
            start(game),
            [
                [c(0), [I]],
                [c(1), [U, R, G, K]],
                [c(3), [J]]
            ],
            {
                [A]: [I]
            }
        )
        state = move(game, state, A, c(0), c(1))
        expect(stackAt(state, c(1))).toEqual([])
        expect(state.players[0].scored).toEqual([[U, R, G, K, I]])
    })

    it('leaves a completed neutral stack as an obstacle that never scores, even once claimed', () => {
        const game = createGame()
        let state = withStacks(start(game), [
            [c(-3), [R]],
            [c(-2), [I]],
            [c(0), [R, I, U]],
            [c(1), [G, K]]
        ])
        state = move(game, state, A, c(0), c(1))
        expect(stackAt(state, c(1))).toEqual([G, K, R, I, U])
        state = claim(game, state, B, U)
        state = move(game, state, B, c(-3), c(-2))
        expect(stackAt(state, c(1))).toHaveLength(5)
        expect(state.players[1].scored).toEqual([])
    })
})

describe('the LYNGK-rule', () => {
    // The red at c(-3) links over the reds at c(-1) and right(-1) to land on the green at right(2).
    const chain = (claims: Record<string, PieceColor[]>) =>
        withStacks(
            start(createGame()),
            [
                [c(-3), [R]],
                [c(-1), [I, R]],
                [right(-1), [R]],
                [right(2), [G]],
                [c(3), [J]]
            ],
            claims
        )

    it('chains through pieces of the claimed color to land beyond them', () => {
        const game = createGame()
        const state = move(game, chain({ [A]: [R] }), A, c(-3), right(2), [c(-1), right(-1)])
        expect(stackAt(state, right(2))).toEqual([G, R])
        expect(stackAt(state, c(-1))).toEqual([I, R])
    })

    it('is not available to a neutral color', () => {
        const game = createGame()
        rejects(game, chain({}), moveAction(game, A, c(-3), right(2), [c(-1), right(-1)]))
    })

    it('uses each LYNGK-point once and never a joker', () => {
        const game = createGame()
        const state = chain({ [A]: [R] })
        rejects(game, state, moveAction(game, A, c(-3), right(2), [c(-1), right(-1), c(-1)]))
        rejects(game, state, moveAction(game, A, c(-3), right(2), [c(-1), c(3)]))
    })
})

describe('passing and the end', () => {
    it('makes a player with no move pass while the other plays on', () => {
        const game = createGame()
        let state = withStacks(
            start(game),
            [
                [c(-3), [R]],
                [c(-2), [G]],
                [c(2), [I]]
            ],
            { [A]: [R, G], [B]: [K, U] }
        )
        state = move(game, state, A, c(-3), c(-2))
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([A])
    })

    it('makes a player claim when only a claim opens a move', () => {
        const game = createGame()
        const state = withStacks(
            start(game),
            [
                [c(0), [G]],
                [c(1), [U, R, K]],
                [c(3), [I]]
            ],
            {
                [B]: [K, U]
            }
        )
        const hydrated = new HydratedLyngkGameState(state)
        expect(hydrated.hasMove(A)).toBe(false)
        expect(hydrated.claimableColors(A)).toEqual([I, G])
        rejects(game, state, claimAction(game, A, R))
        const after = claim(game, state, A, G)
        expect(stackAt(move(game, after, A, c(0), c(1)), c(1))).toEqual([U, R, K, G])
    })

    it('ends when neither player can move and breaks ties on 4-stacks by top color', () => {
        const game = createGame()
        let state = withStacks(
            start(game),
            [
                [c(-3), [R]],
                [c(-2), [U]],
                [c(1), [K, G, I, R]],
                [right(-2), [U, R, G, I]]
            ],
            { [A]: [R, G], [B]: [K, I] }
        )
        state = move(game, state, A, c(-3), c(-2))
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.endReason).toBe(EndReason.NoMoves)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual([A])
    })

    it('is a draw when every count is equal', () => {
        const game = createGame()
        let state = withStacks(
            start(game),
            [
                [c(-3), [R, G]],
                [c(-2), [U]],
                [right(2), [R, K, I]]
            ],
            { [A]: [G, R], [B]: [K, I] }
        )
        state = move(game, state, A, c(-3), c(-2))
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Draw)
        expect(state.winningPlayerIds).toEqual([A, B])
    })
})

describe('stack of 6', () => {
    it('keeps completed stacks of 5 on the board', () => {
        const game = createGame(LyngkVariant.StackOfSix)
        let state = withStacks(
            start(game),
            [
                [c(0), [I]],
                [c(1), [U, R, G, K]],
                [c(3), [J]]
            ],
            {
                [A]: [I]
            }
        )
        state = move(game, state, A, c(0), c(1))
        expect(stackAt(state, c(1))).toEqual([U, R, G, K, I])
        expect(state.machineState).toBe(MachineState.TakingTurn)
    })

    it('wins at once with a stack of 6 topped by a claimed color', () => {
        const game = createGame(LyngkVariant.StackOfSix)
        let state = withStacks(
            start(game),
            [
                [c(0), [I]],
                [c(1), [J, U, R, G, K]],
                [c(3), [J]]
            ],
            {
                [A]: [I]
            }
        )
        state = move(game, state, A, c(0), c(1))
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.endReason).toBe(EndReason.StackOfSix)
        expect(state.winningPlayerIds).toEqual([A])
    })

    it('does not win with a neutral top', () => {
        const game = createGame(LyngkVariant.StackOfSix)
        const state = withStacks(start(game), [
            [c(-3), [R]],
            [c(-2), [U]],
            [c(0), [J, U, R, G, K]],
            [c(1), [I]]
        ])
        rejects(game, state, moveAction(game, A, c(1), c(0)))
        const next = move(game, state, A, c(0), c(1))
        expect(stackAt(next, c(1))).toEqual([I, J, U, R, G, K])
        expect(next.machineState).toBe(MachineState.TakingTurn)
        expect(next.activePlayerIds).toEqual([B])
    })
})

function legalActions(game: LyngkGame, state: LyngkGameState): GameAction[] {
    const hydrated = new HydratedLyngkGameState(state)
    const playerId = state.activePlayerIds[0]
    const claims = hydrated
        .claimableColors(playerId)
        .map((color) => claimAction(game, playerId, color))
    const moves = hydrated
        .pathsFor(playerId)
        .map((path) => moveAction(game, playerId, path.from, path.to, path.via))
    return [...claims, ...moves]
}

describe('random playouts', () => {
    it.each(
        Object.values(LyngkVariant).flatMap((variant) =>
            Array.from({ length: 12 }, (_, seed) => [variant, seed] as const)
        )
    )('%s seed %i plays to a result', (variant, seed) => {
        const game = { ...createGame(variant), seed: seed + 1 }
        let state = start(game)
        let value = seed + 1
        const choose = <T>(options: T[]): T => {
            value = (value * 1103515245 + 12345) % 2147483648
            return options[value % options.length]
        }
        let steps = 0
        while (state.machineState !== MachineState.EndOfGame) {
            const actions = legalActions(game, state)
            expect(actions.length).toBeGreaterThan(0)
            state = execute(game, state, choose(actions))
            steps += 1
            expect(steps).toBeLessThan(500)
        }
        expect(state.winningPlayerIds.length).toBeGreaterThan(0)
        expect(state.endReason).toBeDefined()
    })
})

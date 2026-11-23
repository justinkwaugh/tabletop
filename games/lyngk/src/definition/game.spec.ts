import { describe, expect, it } from 'vitest'
import { assert, GameResult, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    FirstPlayer,
    firstPlayerFromConfig,
    LyngkSetup,
    LyngkVariant,
    setupFromConfig,
    variantFromConfig
} from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { EndReason, HydratedLyngkGameState, type LyngkGameState } from '../model/gameState.js'
import { POINTS } from '../model/geometry.js'
import {
    ACTIVE_COLORS,
    jokerNumber,
    PIECE_COLORS,
    PIECE_COUNT,
    pieceColor,
    PieceColor
} from '../model/pieces.js'
import type { PlacePiece } from '../actions/placePiece.js'
import type { ClaimColor } from '../actions/claimColor.js'
import { isMoveStack, type MoveStack } from '../actions/moveStack.js'
import {
    actionBase as base,
    createGame,
    engine,
    execute,
    MASTER_SEED,
    playToEnd,
    type LyngkGame
} from './tests/playthrough.js'

const A = 'alice'
const B = 'bob'
const { Ivory: I, Blue: U, Red: R, Green: G, Black: K, Joker: J } = PieceColor

function start(game: LyngkGame): LyngkGameState {
    return engine.startGame(game, {
        masterSeed: MASTER_SEED,
        startingPositions: { playerIds: [A, B] }
    }).initialState
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

// The stacks given by colour, each piece a numbered piece of that colour not used before.
function withStacks(
    state: LyngkGameState,
    stacks: [AxialCoordinates, PieceColor[]][],
    claims: Record<string, PieceColor[]> = {}
): LyngkGameState {
    const next = structuredClone(state)
    const unused = Array.from({ length: PIECE_COUNT }, (_, id) => id)
    const take = (color: PieceColor) => {
        const index = unused.findIndex((id) => pieceColor(id) === color)
        if (index < 0) throw Error(`No ${color} piece left`)
        return unused.splice(index, 1)[0]
    }
    next.board = {
        stacks: stacks.map(([coords, colors]) => ({ coords, pieces: colors.map(take) }))
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
        const board = new HydratedLyngkGameState(state).board
        const pieces = POINTS.flatMap((coords) => board.stackAt(coords))
        expect(POINTS.every((coords) => board.stackAt(coords).length === 1)).toBe(true)
        for (const color of ACTIVE_COLORS) {
            expect(pieces.filter((piece) => piece === color)).toHaveLength(8)
        }
        expect(pieces.filter((piece) => piece === J)).toHaveLength(3)
        expect(state.activePlayerIds).toEqual([A])
    })
})

const piecesAt = (state: LyngkGameState, coords: AxialCoordinates) =>
    new HydratedLyngkGameState(state).board.piecesAt(coords)

describe('piece identities', () => {
    it('deals every numbered piece once, its colour following from its number', () => {
        const state = start(createGame())
        const dealt = state.board.stacks.flatMap((stack) => stack.pieces)
        expect(dealt.toSorted((a, b) => a - b)).toEqual(
            Array.from({ length: PIECE_COUNT }, (_, id) => id)
        )
        for (const id of dealt) {
            const color = pieceColor(id)
            if (color === J) {
                expect(jokerNumber(id)).toBeDefined()
            } else {
                expect(jokerNumber(id)).toBeUndefined()
                expect(Math.floor(id / 8)).toBe(ACTIVE_COLORS.indexOf(color))
            }
        }
    })

    it('carries the moved pieces onto the stack they land on', () => {
        const game = createGame()
        const state = withStacks(start(game), [
            [c(-3), [I]],
            [c(0), [U]]
        ])
        const [moving, target] = [piecesAt(state, c(-3)), piecesAt(state, c(0))]
        const moved = move(game, state, A, c(-3), c(0))
        expect(piecesAt(moved, c(0))).toEqual([...target, ...moving])
        expect(piecesAt(moved, c(-3))).toEqual([])
    })

    it('takes them off the board with a scored stack', () => {
        const game = createGame()
        const state = withStacks(
            start(game),
            [
                [c(0), [I]],
                [c(1), [U, R, G, K]]
            ],
            { [A]: [I] }
        )
        const stack = [...piecesAt(state, c(1)), ...piecesAt(state, c(0))]
        const scored = move(game, state, A, c(0), c(1))
        expect(piecesAt(scored, c(1))).toEqual([])
        expect(scored.players[0].scored).toEqual([stack])
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
        expect(state.players[0].scored.map((stack) => stack.map(pieceColor))).toEqual([
            [U, R, G, K, I]
        ])
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
    // Our reading: the point the stack leaves counts as empty during a chain, so a chain can run
    // back across it.
    it('crosses the point the moving stack left as an empty point', () => {
        const game = createGame()
        const state = withStacks(
            start(game),
            [
                [c(0), [I]],
                [c(-2), [I]],
                [c(2), [U, R]]
            ],
            { [A]: [I] }
        )
        const paths = new HydratedLyngkGameState(state).board.pathsFrom(
            c(0),
            { owned: [I], neutral: [] },
            5
        )
        expect(paths).toContainEqual({ from: c(0), via: [c(-2)], to: c(2) })
    })

    // Our reading: only the moving stack's own claimed colour links; the opponent's does not.
    it('lands on, and does not link through, a stack of the opponent’s claimed colour', () => {
        const game = createGame()
        const state = withStacks(
            start(game),
            [
                [c(0), [I]],
                [c(-2), [U]],
                [c(-3), [R]]
            ],
            { [A]: [I], [B]: [U] }
        )
        const paths = new HydratedLyngkGameState(state).board.pathsFrom(
            c(0),
            { owned: [I], neutral: [R, G, K] },
            5
        )
        expect(paths).toContainEqual({ from: c(0), via: [], to: c(-2) })
        expect(paths.some((path) => path.via.length > 0)).toBe(false)
    })

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
        const state = withStacks(
            start(game),
            [
                [c(-3), [R]],
                [c(-2), [G]],
                [c(2), [I]]
            ],
            { [A]: [R, G], [B]: [K, U] }
        )
        const { updatedState, processedActions } = engine.executeCanonicalAction({
            game,
            state,
            action: moveAction(game, A, c(-3), c(-2))
        })
        expect(updatedState.machineState).toBe(MachineState.TakingTurn)
        expect(updatedState.activePlayerIds).toEqual([A])
        // The move that ended the turn records the pass.
        const [moved] = processedActions
        assert(isMoveStack(moved), 'The move is processed')
        expect(moved.metadata?.passedPlayerId).toBe(B)
    })

    it('records no pass when the opponent can act', () => {
        const game = createGame()
        const state = withStacks(start(game), [
            [c(-3), [R]],
            [c(-2), [G]],
            [c(2), [I]],
            [c(3), [U]]
        ])
        const { processedActions } = engine.executeCanonicalAction({
            game,
            state,
            action: moveAction(game, A, c(-3), c(-2))
        })
        const [moved] = processedActions
        assert(isMoveStack(moved), 'The move is processed')
        expect(moved.metadata?.passedPlayerId).toBeUndefined()
    })

    it('offers no claim that would leave the player without a move', () => {
        const game = createGame()
        const state = withStacks(start(game), [[c(0), [R]]])
        const hydrated = new HydratedLyngkGameState(state)
        expect(hydrated.claimableColors(A)).toEqual([])
        expect(hydrated.canAct(A)).toBe(false)
    })

    it('counts a neutral top for no one in the tie-break', () => {
        const game = createGame()
        const state = withStacks(
            start(game),
            [
                [c(0), [I, U, G, R]],
                [c(2), [K, I, U, G]]
            ],
            { [A]: [G], [B]: [K] }
        )
        const hydrated = new HydratedLyngkGameState(state)
        // The red top is no one's; the green top is Alice's.
        expect(hydrated.rankingOf(A)[1]).toBe(1)
        expect(hydrated.rankingOf(B)[1]).toBe(0)
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

describe('setting the board', () => {
    const placeAction = (
        game: LyngkGame,
        playerId: string,
        coords: AxialCoordinates,
        color: PieceColor
    ): PlacePiece => ({ ...base(game, playerId), type: ActionType.PlacePiece, coords, color })

    // Every piece, colour by colour, the jokers last.
    const kit = PIECE_COLORS.flatMap((color) =>
        Array.from({ length: color === J ? 3 : 8 }, () => color)
    )

    function setBoard(game: LyngkGame, placer: (index: number) => string) {
        let state = start(game)
        POINTS.forEach((coords, index) => {
            expect(state.machineState).toBe(MachineState.PlacingPieces)
            expect(state.activePlayerIds).toEqual([placer(index)])
            state = execute(game, state, placeAction(game, placer(index), coords, kit[index]))
        })
        return state
    }

    it('starts on an empty board when the players set it', () => {
        for (const setup of [LyngkSetup.TakeTurns, LyngkSetup.ISetYouStart]) {
            const state = start(createGame(LyngkVariant.Standard, [A, B], setup))
            expect(state.board.stacks).toEqual([])
            expect(state.machineState).toBe(MachineState.PlacingPieces)
            expect(state.activePlayerIds).toEqual([A])
        }
    })

    it('takes turns placing any piece, then the second player moves first', () => {
        const game = createGame(LyngkVariant.Standard, [A, B], LyngkSetup.TakeTurns)
        const state = setBoard(game, (index) => (index % 2 === 0 ? A : B))
        const hydrated = new HydratedLyngkGameState(state)
        expect(POINTS.map((coords) => hydrated.board.stackAt(coords))).toEqual(
            kit.map((color) => [color])
        )
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
        expect(hydrated.hasMove(B)).toBe(true)
    })

    it('lets the first player set every piece alone, then the other moves first', () => {
        const game = createGame(LyngkVariant.Standard, [A, B], LyngkSetup.ISetYouStart)
        const state = setBoard(game, () => A)
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('places each numbered piece once, and none of a colour that has run out', () => {
        const game = createGame(LyngkVariant.Standard, [A, B], LyngkSetup.ISetYouStart)
        let state = start(game)
        POINTS.slice(0, 3).forEach((coords) => {
            state = execute(game, state, placeAction(game, A, coords, J))
        })
        expect(state.board.stacks.map((stack) => stack.pieces[0]).map(jokerNumber)).toEqual([
            0, 1, 2
        ])
        rejects(game, state, placeAction(game, A, POINTS[3], J))
        rejects(game, state, placeAction(game, A, POINTS[0], R))
        rejects(game, state, placeAction(game, A, { q: 0.5, r: 0 }, R))
        rejects(game, state, placeAction(game, B, POINTS[3], R))
    })
})

describe('choice of first player', () => {
    const owner = { ownerId: 'u-bob', userIds: { [A]: 'u-alice', [B]: 'u-bob' } }
    const startUnassigned = (game: LyngkGame) =>
        engine.startGame(game, { masterSeed: MASTER_SEED }).initialState
    const firstOf = (state: LyngkGameState) => state.turnManager.turnOrder[0]

    it('gives the first move to the game creator or the opponent when chosen', () => {
        const creatorFirst = startUnassigned(
            createGame(LyngkVariant.Standard, [A, B], LyngkSetup.Random, {
                ...owner,
                firstPlayer: FirstPlayer.Creator
            })
        )
        expect(creatorFirst.activePlayerIds).toEqual([B])
        const opponentFirst = startUnassigned(
            createGame(LyngkVariant.Standard, [A, B], LyngkSetup.Random, {
                ...owner,
                firstPlayer: FirstPlayer.Opponent
            })
        )
        expect(opponentFirst.activePlayerIds).toEqual([A])
    })

    it('has the chosen first player place the first piece when the players set the board', () => {
        for (const setup of [LyngkSetup.TakeTurns, LyngkSetup.ISetYouStart]) {
            const state = startUnassigned(
                createGame(LyngkVariant.Standard, [A, B], setup, {
                    ...owner,
                    firstPlayer: FirstPlayer.Creator
                })
            )
            expect(state.machineState).toBe(MachineState.PlacingPieces)
            expect(state.activePlayerIds).toEqual([B])
        }
    })

    it('draws the first player by lot when Random, and when the creator does not play', () => {
        const outsider = { ownerId: 'u-host', userIds: { [A]: 'u-alice', [B]: 'u-bob' } }
        for (const options of [
            { firstPlayer: FirstPlayer.Random },
            { ...outsider, firstPlayer: FirstPlayer.Creator },
            { ...outsider, firstPlayer: FirstPlayer.Opponent }
        ]) {
            const firsts = new Set(
                [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
                    const game = {
                        ...createGame(LyngkVariant.Standard, [A, B], LyngkSetup.Random, options),
                        seed
                    }
                    const state = engine.startGame(game).initialState
                    expect(state.activePlayerIds).toEqual([firstOf(state)])
                    return firstOf(state)
                })
            )
            expect(firsts).toEqual(new Set([A, B]))
        }
    })
})

describe('configuration', () => {
    it('reads a missing variant as Standard and rejects an unknown one', () => {
        expect(variantFromConfig({})).toBe(LyngkVariant.Standard)
        expect(variantFromConfig({ variant: 'StackOfSix' })).toBe(LyngkVariant.StackOfSix)
        expect(() => variantFromConfig({ variant: 'NoSuchVariant' })).toThrow()
    })

    it('reads a missing setup as Random and rejects an unknown one', () => {
        expect(setupFromConfig({})).toBe(LyngkSetup.Random)
        expect(setupFromConfig({ setup: 'TakeTurns' })).toBe(LyngkSetup.TakeTurns)
        expect(() => setupFromConfig({ setup: 'NoSuchSetup' })).toThrow()
    })

    it('reads a missing first player as Random and rejects an unknown one', () => {
        expect(firstPlayerFromConfig({})).toBe(FirstPlayer.Random)
        expect(firstPlayerFromConfig({ firstPlayer: 'Opponent' })).toBe(FirstPlayer.Opponent)
        expect(() => firstPlayerFromConfig({ firstPlayer: 'NoSuchPlayer' })).toThrow()
    })
})

describe('random playouts', () => {
    it.each(
        Object.values(LyngkVariant).flatMap((variant) =>
            Object.values(LyngkSetup).flatMap((setup) =>
                Array.from({ length: 6 }, (_, seed) => [variant, setup, seed] as const)
            )
        )
    )('%s, %s setup, seed %i plays to a result', (variant, setup, seed) => {
        const game = createGame(variant, ['alice', 'bob'], setup)
        const finished = playToEnd(game, start(game), seed)
        expect(finished.winningPlayerIds.length).toBeGreaterThan(0)
        expect(finished.endReason).toBeDefined()
        // Nothing reads past turns, so the series keeps only each player's latest.
        expect(finished.turnManager.series.length).toBeLessThanOrEqual(2)
    })

    it('deals and plays the same game from the same master seed', () => {
        const game = createGame()
        const outcome = (state: LyngkGameState) => ({
            board: state.board,
            players: state.players,
            winners: state.winningPlayerIds,
            actions: state.actionCount
        })
        expect(start(game).board).toEqual(start(game).board)
        expect(outcome(playToEnd(game, start(game), 3))).toEqual(
            outcome(playToEnd(game, start(game), 3))
        )
    })
})

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
import { GipfRuntime } from './runtime.js'
import { GipfInfo } from './info.js'
import { GipfVersion } from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { EndReason, HydratedGipfGameState, type GipfGameState } from '../model/gameState.js'
import { emptyBoard, type Piece } from '../model/board.js'
import { ENTRIES } from '../model/geometry.js'
import type { PushPiece } from '../actions/pushPiece.js'
import type { RemoveRow } from '../actions/removeRow.js'
import type { FinishRemoving } from '../actions/finishRemoving.js'

const engine = new GameEngine(GipfRuntime)
const W = 'white'
const B = 'black'

function createGame(version: GipfVersion = GipfVersion.Standard) {
    return GipfRuntime.initializer.initializeGame(
        {
            id: 'gipf-test',
            typeId: 'gipf',
            ownerId: 'owner',
            seed: 5,
            config: { ...defaultGameConfig(GipfInfo.configurator?.options ?? []), version },
            players: [W, B].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

type GipfGame = ReturnType<typeof createGame>

function start(game: GipfGame): GipfGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [W, B] } }).initialState
}

let counter = 0
function base(game: GipfGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

function execute(game: GipfGame, state: GipfGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

function push(
    game: GipfGame,
    state: GipfGameState,
    playerId: string,
    dot: AxialCoordinates,
    to: AxialCoordinates,
    gipf = false
) {
    const action: PushPiece = { ...base(game, playerId), type: ActionType.PushPiece, dot, to, gipf }
    return execute(game, state, action)
}

function removeRow(
    game: GipfGame,
    state: GipfGameState,
    playerId: string,
    from: AxialCoordinates,
    to: AxialCoordinates,
    keep: AxialCoordinates[] = []
) {
    const action: RemoveRow = {
        ...base(game, playerId),
        type: ActionType.RemoveRow,
        from,
        to,
        keep
    }
    return execute(game, state, action)
}

function finish(game: GipfGame, state: GipfGameState, playerId: string) {
    const action: FinishRemoving = { ...base(game, playerId), type: ActionType.FinishRemoving }
    return execute(game, state, action)
}

// Column e runs from dot e1 (0,4) at the bottom up to dot e9 (0,-4).
const E1: AxialCoordinates = { q: 0, r: 4 }
const e = (number: number): AxialCoordinates => ({ q: 0, r: 4 - (number - 1) })

function withPieces(
    state: GipfGameState,
    pieces: [AxialCoordinates, Piece][],
    reserves?: Record<string, number>
): GipfGameState {
    const next = structuredClone(state)
    next.board = emptyBoard()
    for (const [coords, piece] of pieces) {
        const spot = next.board.spots.find(
            (s) => s.coords.q === coords.q && s.coords.r === coords.r
        )
        if (spot === undefined) throw Error('not a spot')
        spot.piece = piece
    }
    for (const player of next.players) {
        const reserve = reserves?.[player.playerId]
        if (reserve !== undefined) player.reserve = reserve
    }
    return next
}

const single = (playerId: string): Piece => ({ playerId, gipf: false })
const gipf = (playerId: string): Piece => ({ playerId, gipf: true })

// Keeps both players' GIPF-pieces on the board, off column e, so games do not end early.
const KEEPERS: [AxialCoordinates, Piece][] = [
    [{ q: -3, r: 0 }, gipf(W)],
    [{ q: 3, r: -3 }, gipf(B)]
]

describe('board', () => {
    it('has 37 spots and 42 ways in', () => {
        expect(emptyBoard().spots).toHaveLength(37)
        expect(ENTRIES).toHaveLength(42)
    })
})

describe('setup', () => {
    it.each([
        [GipfVersion.Basic, 3, 12, false],
        [GipfVersion.Standard, 3, 12, true],
        [GipfVersion.Tournament, 0, 18, false]
    ])(
        '%s: %i pieces each on the board, %i in reserve',
        (version, onBoard, reserve, gipfPieces) => {
            const state = new HydratedGipfGameState(start(createGame(version)))
            expect(state.board.pieces().filter((piece) => piece.playerId === W)).toHaveLength(
                onBoard
            )
            expect(state.board.pieces().every((piece) => piece.gipf === gipfPieces)).toBe(true)
            expect(state.players.map((player) => player.reserve)).toEqual([reserve, reserve])
            expect(state.activePlayerIds).toEqual([W])
            expect(state.getPlayerState(W).color).toBe('white')
        }
    )
})

describe('pushing', () => {
    it('pushes a chain of pieces one spot along the line', () => {
        const game = createGame()
        let state = withPieces(start(game), [...KEEPERS, [e(2), single(B)], [e(3), single(W)]])
        state = push(game, state, W, E1, e(2))
        const board = new HydratedGipfGameState(state).board
        expect(board.pieceAt(e(2))).toEqual(single(W))
        expect(board.pieceAt(e(3))).toEqual(single(B))
        expect(board.pieceAt(e(4))).toEqual(single(W))
        expect(state.players[0].reserve).toBe(11)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('refuses to push along a full line', () => {
        const game = createGame()
        const full: [AxialCoordinates, Piece][] = [2, 3, 4, 5, 6, 7, 8].map((n) => [
            e(n),
            single(n % 2 === 0 ? W : B)
        ])
        const state = withPieces(start(game), [...KEEPERS, ...full])
        expect(() => push(game, state, W, E1, e(2))).toThrow()
    })
})

describe('rows', () => {
    it('removes a row of four with its extensions: own pieces to reserve, the rest captured', () => {
        const game = createGame()
        const setup = withPieces(
            start(game),
            [
                ...KEEPERS,
                [e(2), single(W)],
                [e(3), single(W)],
                [e(4), single(W)],
                [e(5), single(B)],
                [e(6), single(B)]
            ],
            { [W]: 10 }
        )
        let state = push(game, setup, W, E1, e(2))
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([W])
        expect(() => finish(game, state, W)).toThrow()

        state = removeRow(game, state, W, e(2), e(5))
        const board = new HydratedGipfGameState(state).board
        expect([2, 3, 4, 5, 6, 7].every((n) => board.pieceAt(e(n)) === undefined)).toBe(true)
        expect(state.players[0].reserve).toBe(9 + 4)
        expect(state.players[0].captured).toBe(2)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('lets the owner keep GIPF-pieces in a row', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            [e(2), gipf(W)],
            [e(3), single(W)],
            [e(4), single(W)]
        ])
        state = push(game, state, W, E1, e(2))
        state = removeRow(game, state, W, e(2), e(5), [e(3)])
        const board = new HydratedGipfGameState(state).board
        expect(board.pieceAt(e(3))).toEqual(gipf(W))
        expect(board.pieceAt(e(2))).toBeUndefined()
    })

    it('has the mover take their rows before the opponent takes theirs', () => {
        const game = createGame()
        const blackRow: [AxialCoordinates, Piece][] = [1, 2, 3, 4].map((n) => [
            { q: n - 2, r: -2 },
            single(B)
        ])
        let state = withPieces(start(game), [
            ...KEEPERS,
            ...blackRow,
            [e(2), single(W)],
            [e(3), single(W)],
            [e(4), single(W)]
        ])
        state = push(game, state, W, E1, e(2))
        expect(state.activePlayerIds).toEqual([W])
        state = removeRow(game, state, W, e(2), e(5))
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([B])
        state = removeRow(game, state, B, { q: -1, r: -2 }, { q: 2, r: -2 })
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('lets a row of only GIPF-pieces stand', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            [e(3), gipf(W)],
            [e(4), gipf(W)],
            [e(5), gipf(W)],
            [e(6), gipf(W)]
        ])
        state = push(game, state, W, E1, e(2), false)
        state = removeRow(game, state, W, e(2), e(6), [e(3), e(4), e(5), e(6)])
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        state = finish(game, state, W)
        expect(state.activePlayerIds).toEqual([B])
    })
})

describe('tournament', () => {
    it('starts with GIPF-pieces until a player plays a single', () => {
        const game = createGame(GipfVersion.Tournament)
        let state = start(game)
        expect(() => push(game, state, W, E1, e(2), false)).toThrow()
        state = push(game, state, W, E1, e(2), true)
        expect(state.players[0].reserve).toBe(16)
        state = push(game, state, B, { q: 0, r: -4 }, e(8), true)
        state = push(game, state, W, E1, e(2), false)
        state = push(game, state, B, { q: 0, r: -4 }, e(8), true)
        expect(() => push(game, state, W, { q: -4, r: 4 }, { q: -3, r: 3 }, true)).toThrow()
    })
})

describe('end of game', () => {
    it('a player who loses their last GIPF-piece loses', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            [{ q: -3, r: 0 }, gipf(W)],
            [e(2), single(W)],
            [e(3), single(W)],
            [e(4), single(W)],
            [e(5), gipf(B)]
        ])
        state = push(game, state, W, E1, e(2))
        state = removeRow(game, state, W, e(2), e(5))
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual([W])
        expect(state.endReason).toBe(EndReason.NoGipfPieces)
    })

    it('a player with no piece to bring in loses', () => {
        const game = createGame()
        let state = withPieces(start(game), KEEPERS, { [B]: 0 })
        state = push(game, state, W, E1, e(2))
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual([W])
        expect(state.endReason).toBe(EndReason.NoReserve)
    })
})

function legalActions(game: GipfGame, state: GipfGameState): GameAction[] {
    const hydrated = new HydratedGipfGameState(state)
    const playerId = state.activePlayerIds[0]
    const { board } = hydrated
    if (state.machineState === MachineState.ResolvingRows) {
        const rows = board.rowsOf(playerId)
        const removals: GameAction[] = rows.map((row) => ({
            ...base(game, playerId),
            type: ActionType.RemoveRow,
            from: row.from,
            to: row.to,
            keep: row.reach.filter(
                (coords) =>
                    board.pieceAt(coords)?.gipf && board.pieceAt(coords)?.playerId === playerId
            )
        }))
        const valid = removals.filter((action) => {
            try {
                execute(game, state, action)
                return true
            } catch {
                return false
            }
        })
        const mustRemove = rows.some((row) => board.isMandatory(row))
        return mustRemove
            ? valid
            : [...valid, { ...base(game, playerId), type: ActionType.FinishRemoving }]
    }
    const pieceTypes = [
        ...(hydrated.canPlaySingle(playerId) ? [false] : []),
        ...(hydrated.canPlayGipf(playerId) ? [true] : [])
    ]
    return board.legalEntries().flatMap((entry) =>
        pieceTypes.map((isGipf) => ({
            ...base(game, playerId),
            type: ActionType.PushPiece,
            dot: entry.dot,
            to: entry.line[0],
            gipf: isGipf
        }))
    )
}

describe('random playouts', () => {
    it.each(
        Object.values(GipfVersion).flatMap((version) =>
            Array.from({ length: 10 }, (_, seed) => [version, seed] as const)
        )
    )('%s seed %i plays to a single winner', (version, seed) => {
        const game = createGame(version)
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
            expect(steps).toBeLessThan(2000)
        }
        expect(state.winningPlayerIds).toHaveLength(1)
        expect(state.endReason).toBeDefined()
    })
})

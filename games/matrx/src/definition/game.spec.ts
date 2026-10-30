import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    GameResult,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from './definition.js'
import { MatrxRuntime } from './runtime.js'
import { MatrxInfo } from './info.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { EndReason, HydratedMatrxGameState, type MatrxGameState } from '../model/gameState.js'
import { emptyBoard, PieceKind, POTENTIAL_KINDS, type Unit } from '../model/board.js'
import { BoardShape, GEOMETRIES, pointAt } from '../model/geometry.js'
import type { Potentials } from '../model/playerState.js'
import type { PushPiece } from '../actions/pushPiece.js'
import type { MovePotential } from '../actions/movePotential.js'
import type { ExtraMove } from '../actions/extraMove.js'
import type { RemoveRow } from '../actions/removeRow.js'

const engine = new GameEngine(MatrxRuntime)
const W = 'white'
const B = 'black'

function createGame(board: BoardShape = BoardShape.Matrx) {
    return MatrxRuntime.initializer.initializeGame(
        {
            id: 'matrx-test',
            typeId: 'matrx',
            ownerId: 'owner',
            seed: 5,
            config: { ...defaultGameConfig(MatrxInfo.configurator?.options ?? []), board },
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

type MatrxGame = ReturnType<typeof createGame>

function start(game: MatrxGame): MatrxGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [W, B] } }).initialState
}

let counter = 0
function base(game: MatrxGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

function execute(game: MatrxGame, state: MatrxGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

const at = pointAt

function push(
    game: MatrxGame,
    state: MatrxGameState,
    playerId: string,
    dot: string,
    to: string,
    kind: PieceKind
) {
    const action: PushPiece = {
        ...base(game, playerId),
        type: ActionType.PushPiece,
        dot: at(dot),
        to: at(to),
        kind
    }
    return execute(game, state, action)
}

function move(game: MatrxGame, state: MatrxGameState, playerId: string, from: string, to: string) {
    const action: MovePotential = {
        ...base(game, playerId),
        type: ActionType.MovePotential,
        from: at(from),
        to: at(to)
    }
    return execute(game, state, action)
}

function extraMove(
    game: MatrxGame,
    state: MatrxGameState,
    playerId: string,
    dot: string,
    to: string
) {
    const action: ExtraMove = {
        ...base(game, playerId),
        type: ActionType.ExtraMove,
        dot: at(dot),
        to: at(to)
    }
    return execute(game, state, action)
}

function skipExtraMove(game: MatrxGame, state: MatrxGameState, playerId: string) {
    return execute(game, state, { ...base(game, playerId), type: ActionType.SkipExtraMove })
}

function removeRow(
    game: MatrxGame,
    state: MatrxGameState,
    playerId: string,
    from: string,
    to: string,
    keep: string[] = []
) {
    const action: RemoveRow = {
        ...base(game, playerId),
        type: ActionType.RemoveRow,
        from: at(from),
        to: at(to),
        keep: keep.map(at)
    }
    return execute(game, state, action)
}

const pair = (playerId: string, kind: PieceKind): Unit => ({ playerId, kind, paired: true })
const single = (playerId: string, kind: PieceKind): Unit => ({ playerId, kind, paired: false })
const gipf = (playerId: string): Unit => single(playerId, PieceKind.Gipf)

const potentials = (count: number): Potentials => ({
    tamsk: count,
    zertz: count,
    dvonn: count,
    yinsh: count,
    punct: count
})

type Reserve = { gipfPieces?: number; potentials?: Potentials }

// Every GIPF piece on the board, out of the way of the tests, so games go on.
const KEEPERS: [string, Unit[]][] = [
    ['B2', [gipf(W)]],
    ['B3', [gipf(W)]],
    ['C2', [gipf(W)]],
    ['H2', [gipf(B)]],
    ['H3', [gipf(B)]],
    ['G2', [gipf(B)]]
]

function withPieces(
    state: MatrxGameState,
    pieces: [string, Unit[]][],
    reserves: Record<string, Reserve> = {}
): MatrxGameState {
    const next = structuredClone(state)
    next.board = emptyBoard(next.board.shape)
    for (const [name, stack] of pieces) {
        const coords = at(name)
        const spot = next.board.spots.find(
            (candidate) => candidate.coords.q === coords.q && candidate.coords.r === coords.r
        )
        if (spot === undefined) throw Error(`${name} is not a spot`)
        spot.stack = stack.map((unit) => ({ ...unit }))
    }
    for (const player of next.players) {
        player.gipfPieces = reserves[player.playerId]?.gipfPieces ?? 0
        player.potentials = reserves[player.playerId]?.potentials ?? potentials(6)
    }
    return next
}

const boardOf = (state: MatrxGameState) => new HydratedMatrxGameState(state).board
const stackAt = (state: MatrxGameState, name: string) => boardOf(state).stackAt(at(name))

describe('board', () => {
    it('MATRX: 40 spots and 25 dots, with column I three spots and column J four dots', () => {
        const geometry = GEOMETRIES[BoardShape.Matrx]
        expect(geometry.spots).toHaveLength(40)
        expect(geometry.dots).toHaveLength(25)
        expect(['I2', 'I3', 'I4', 'E5'].every((name) => geometry.isSpot(at(name)))).toBe(true)
        expect(['J1', 'J4', 'I1', 'I5', 'A5'].every((name) => geometry.isDot(at(name)))).toBe(true)
        expect(geometry.lineFrom(at('E2'), { q: 0, r: -1 })).toHaveLength(7)
    })

    it('GIPF: 37 spots and 24 dots', () => {
        const geometry = GEOMETRIES[BoardShape.Gipf]
        expect(geometry.spots).toHaveLength(37)
        expect(geometry.dots).toHaveLength(24)
        expect(geometry.entries).toHaveLength(42)
    })
})

describe('setup', () => {
    it.each(Object.values(BoardShape))(
        '%s: empty board, all pieces in reserve, White first',
        (shape) => {
            const state = new HydratedMatrxGameState(start(createGame(shape)))
            expect(state.board.shape).toBe(shape)
            expect(state.board.tops()).toHaveLength(0)
            for (const player of state.players) {
                expect(player.gipfPieces).toBe(3)
                expect(player.potentials).toEqual(potentials(6))
            }
            expect(state.activePlayerIds).toEqual([W])
            expect(state.getPlayerState(W).color).toBe('white')
        }
    )
})

describe('GIPF pieces', () => {
    it('the first three moves bring in the GIPF pieces', () => {
        const game = createGame()
        let state = start(game)
        expect(() => push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)).toThrow()
        for (let turn = 0; turn < 3; turn++) {
            state = push(game, state, W, 'E1', 'E2', PieceKind.Gipf)
            state = push(game, state, B, 'E9', 'E8', PieceKind.Gipf)
        }
        state = push(game, state, W, 'A1', 'B2', PieceKind.Yinsh)
        expect(stackAt(state, 'B2')).toEqual([pair(W, PieceKind.Yinsh)])
        expect(state.players[0].potentials.yinsh).toBe(4)
        expect(state.players[0].gipfPieces).toBe(0)
    })

    it('a GIPF piece that cannot be pushed in lets a potential move instead', () => {
        const game = createGame()
        const names = GEOMETRIES[BoardShape.Matrx].spots.map((coords) => coords)
        const full = withPieces(start(game), [], { [W]: { gipfPieces: 1 } })
        full.board.spots.forEach((spot, index) => {
            spot.stack = [gipf(index % 2 === 0 ? W : B)]
        })
        const board = boardOf(full)
        const dvonnAt = names.find((coords) =>
            board.geometry.isSpot({ q: coords.q + 1, r: coords.r })
        )
        if (dvonnAt === undefined) throw Error('no pair of spots')
        const targetAt = { q: dvonnAt.q + 1, r: dvonnAt.r }
        for (const spot of full.board.spots) {
            if (spot.coords.q === dvonnAt.q && spot.coords.r === dvonnAt.r) {
                spot.stack = [pair(W, PieceKind.Dvonn)]
            }
            if (spot.coords.q === targetAt.q && spot.coords.r === targetAt.r) {
                spot.stack = [single(B, PieceKind.Dvonn)]
            }
        }
        const hydrated = new HydratedMatrxGameState(full)
        expect(hydrated.mustPlayGipf(W)).toBe(false)
        expect(hydrated.potentialMoves(W)).toEqual([{ from: dvonnAt, to: targetAt }])
    })

    it('a GIPF piece in a row must go: back to its owner, who must bring it in next', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E3', [gipf(W)]],
            ['E4', [pair(W, PieceKind.Yinsh)]],
            ['E5', [pair(W, PieceKind.Yinsh)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Zertz)
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(() => removeRow(game, state, W, 'E2', 'E5', ['E3'])).toThrow()
        state = removeRow(game, state, W, 'E2', 'E5', ['E2', 'E4', 'E5'])
        expect(stackAt(state, 'E3')).toEqual([])
        expect(state.players[0].gipfPieces).toBe(1)
        state = push(game, state, B, 'J1', 'I2', PieceKind.Yinsh)
        expect(() => push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)).toThrow()
        expect(() => move(game, state, W, 'E2', 'D2')).toThrow()
        state = push(game, state, W, 'E1', 'E2', PieceKind.Gipf)
        expect(state.players[0].gipfPieces).toBe(0)
    })
})

describe('pushing', () => {
    it('pushes stacks along the line, whole', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [pair(B, PieceKind.Dvonn), single(W, PieceKind.Dvonn)]],
            ['E3', [pair(W, PieceKind.Tamsk)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Punct)
        expect(stackAt(state, 'E2')).toEqual([pair(W, PieceKind.Punct)])
        expect(stackAt(state, 'E3')).toEqual([pair(B, PieceKind.Dvonn), single(W, PieceKind.Dvonn)])
        expect(stackAt(state, 'E4')).toEqual([pair(W, PieceKind.Tamsk)])
        expect(state.players[0].potentials.punct).toBe(4)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('refuses to push along a full line', () => {
        const game = createGame()
        const full: [string, Unit[]][] = [2, 3, 4, 5, 6, 7, 8].map((n) => [
            `E${n}`,
            [pair(n % 2 === 0 ? W : B, PieceKind.Yinsh)]
        ])
        const state = withPieces(start(game), [...KEEPERS, ...full])
        expect(() => push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)).toThrow()
    })
})

describe('potentials', () => {
    it('moving splits the stack: the top piece moves, both are used singles', () => {
        const game = createGame()
        let state = withPieces(start(game), [...KEEPERS, ['D4', [pair(W, PieceKind.Yinsh)]]])
        state = move(game, state, W, 'D4', 'D7')
        expect(stackAt(state, 'D4')).toEqual([single(W, PieceKind.Yinsh)])
        expect(stackAt(state, 'D7')).toEqual([single(W, PieceKind.Yinsh)])
        state = push(game, state, B, 'J1', 'I2', PieceKind.Yinsh)
        expect(() => move(game, state, W, 'D4', 'D5')).toThrow()
    })

    it('YINSH slides over empty spots only', () => {
        const game = createGame()
        const state = withPieces(start(game), [
            ...KEEPERS,
            ['D4', [pair(W, PieceKind.Yinsh)]],
            ['D6', [pair(B, PieceKind.Yinsh)]]
        ])
        const targets = boardOf(state).potentialTargets(at('D4'))
        expect(targets).toContainEqual(at('D5'))
        expect(targets).not.toContainEqual(at('D6'))
        expect(targets).not.toContainEqual(at('D7'))
    })

    it('ZÈRTZ jumps a run of pieces to the first vacant spot, never over a gap or onto a dot', () => {
        const game = createGame()
        const state = withPieces(start(game), [
            ...KEEPERS,
            ['E4', [pair(W, PieceKind.Zertz)]],
            ['E5', [gipf(B)]],
            ['E6', [pair(W, PieceKind.Yinsh)]],
            ['D4', [single(B, PieceKind.Punct)]],
            ['F4', [gipf(B)]],
            ['G4', [gipf(B)]],
            ['H4', [gipf(B)]],
            ['I4', [gipf(B)]]
        ])
        const targets = boardOf(state).potentialTargets(at('E4'))
        expect(targets).toContainEqual(at('E7'))
        expect(targets).toContainEqual(at('C4'))
        expect(targets).toHaveLength(2)
    })

    it('DVONN jumps only onto an opposing DVONN potential, over empty spots, and covers it', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['D3', [pair(W, PieceKind.Dvonn)]],
            ['D6', [pair(B, PieceKind.Dvonn)]],
            ['E3', [single(B, PieceKind.Punct)]],
            ['F4', [gipf(B)]],
            ['C3', [single(W, PieceKind.Dvonn)]]
        ])
        expect(boardOf(state).potentialTargets(at('D3'))).toEqual([at('D6')])
        state = move(game, state, W, 'D3', 'D6')
        expect(stackAt(state, 'D6')).toEqual([pair(B, PieceKind.Dvonn), single(W, PieceKind.Dvonn)])
        expect(boardOf(state).topAt(at('D6'))?.playerId).toBe(W)
    })

    it('PÜNCT jumps only onto an opposing PÜNCT potential', () => {
        const game = createGame()
        const state = withPieces(start(game), [
            ...KEEPERS,
            ['D3', [pair(W, PieceKind.Punct)]],
            ['D5', [single(B, PieceKind.Dvonn)]],
            [
                'E3',
                [pair(B, PieceKind.Punct), single(W, PieceKind.Punct), single(B, PieceKind.Punct)]
            ]
        ])
        expect(boardOf(state).potentialTargets(at('D3'))).toEqual([at('E3')])
    })

    it('TAMSK stacks have no move of their own', () => {
        const game = createGame()
        const state = withPieces(start(game), [...KEEPERS, ['D3', [pair(W, PieceKind.Tamsk)]]])
        expect(boardOf(state).potentialTargets(at('D3'))).toEqual([])
    })
})

describe('rows', () => {
    it('singles must go and stacks may stay: own pieces to reserve, the rest captured', () => {
        const game = createGame()
        const setup = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [pair(W, PieceKind.Yinsh)]],
            ['E3', [single(W, PieceKind.Dvonn)]],
            ['E4', [single(W, PieceKind.Yinsh)]],
            ['E5', [pair(B, PieceKind.Zertz)]],
            ['E6', [single(B, PieceKind.Punct)]]
        ])
        let state = push(game, setup, W, 'E1', 'E2', PieceKind.Tamsk)
        expect(stackAt(state, 'E5')).toEqual([single(W, PieceKind.Yinsh)])
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(() => removeRow(game, state, W, 'E2', 'E5', ['E4'])).toThrow()
        state = removeRow(game, state, W, 'E2', 'E5', ['E3', 'E6'])
        expect(stackAt(state, 'E2')).toEqual([])
        expect(stackAt(state, 'E3')).toEqual([pair(W, PieceKind.Yinsh)])
        expect(stackAt(state, 'E6')).toEqual([pair(B, PieceKind.Zertz)])
        expect(stackAt(state, 'E7')).toEqual([])
        expect(state.players[0].potentials.tamsk).toBe(6)
        expect(state.players[0].potentials.yinsh).toBe(6 + 1)
        expect(state.players[0].potentials.dvonn).toBe(6 + 1)
        expect(state.players[0].captured).toBe(1)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('a row of four stacks must be broken', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E3', [pair(W, PieceKind.Yinsh)]],
            ['E4', [pair(W, PieceKind.Yinsh)]],
            ['E5', [pair(W, PieceKind.Zertz)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        expect(() => removeRow(game, state, W, 'E2', 'E5', ['E2', 'E3', 'E4', 'E5'])).toThrow()
        state = removeRow(game, state, W, 'E2', 'E5', ['E2', 'E3', 'E4'])
        expect(state.activePlayerIds).toEqual([B])
    })

    it('removing a covering piece can uncover a new row, which must go too', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['C4', [pair(W, PieceKind.Yinsh)]],
            ['D4', [pair(W, PieceKind.Yinsh)]],
            ['F3', [pair(W, PieceKind.Yinsh)]],
            ['E4', [pair(W, PieceKind.Dvonn), single(B, PieceKind.Dvonn)]],
            ['E5', [single(B, PieceKind.Yinsh)]],
            ['E6', [single(B, PieceKind.Yinsh)]],
            ['E7', [single(B, PieceKind.Yinsh)]],
            ['I3', [pair(W, PieceKind.Yinsh)]]
        ])
        state = move(game, state, W, 'I3', 'I4')
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([B])
        state = removeRow(game, state, B, 'E4', 'E7')
        expect(stackAt(state, 'E4')).toEqual([pair(W, PieceKind.Dvonn)])
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
        state = push(game, state, B, 'J1', 'I2', PieceKind.Yinsh)
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([W])
        state = removeRow(game, state, W, 'C4', 'F3', ['C4', 'D4', 'F3'])
        expect(state.activePlayerIds).toEqual([W])
        expect(state.machineState).toBe(MachineState.TakingTurn)
    })

    it('the mover takes their rows before the opponent takes theirs', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['C6', [single(B, PieceKind.Yinsh)]],
            ['D6', [single(B, PieceKind.Yinsh)]],
            ['E6', [pair(B, PieceKind.Yinsh)]],
            ['F5', [single(B, PieceKind.Yinsh)]],
            ['E3', [single(W, PieceKind.Yinsh)]],
            ['E4', [single(W, PieceKind.Yinsh)]],
            ['E5', [single(W, PieceKind.Yinsh)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        expect(boardOf(state).rowsOf(B)).toHaveLength(1)
        expect(state.activePlayerIds).toEqual([W])
        state = removeRow(game, state, W, 'E2', 'E5', ['E2', 'E6'])
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([B])
    })
})

describe('TAMSK', () => {
    // Column E's push from E1 shifts E4 onto the centre E5.
    const tamskBelowCentre: [string, Unit[]][] = [
        ['E2', [single(B, PieceKind.Yinsh)]],
        ['E3', [single(W, PieceKind.Yinsh)]],
        ['E4', [pair(W, PieceKind.Tamsk)]]
    ]

    it('pushing your TAMSK stack onto E5 gives an extra move with its top piece, before rows go', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ...tamskBelowCentre,
            ['E6', [single(W, PieceKind.Yinsh)]],
            ['E7', [single(W, PieceKind.Yinsh)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        expect(stackAt(state, 'E5')).toEqual([pair(W, PieceKind.Tamsk)])
        expect(boardOf(state).rowsOf(W)).toHaveLength(1)
        expect(state.machineState).toBe(MachineState.ExtraMove)
        expect(state.activePlayerIds).toEqual([W])
        state = extraMove(game, state, W, 'A3', 'B3')
        expect(stackAt(state, 'E5')).toEqual([single(W, PieceKind.Tamsk)])
        expect(stackAt(state, 'B3')).toEqual([single(W, PieceKind.Tamsk)])
        expect(stackAt(state, 'C3')).toEqual([gipf(W)])
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.players[0].potentials.tamsk).toBe(6)
    })

    it('an extra move not made sends its TAMSK potential out of the game', () => {
        const game = createGame()
        let state = withPieces(start(game), [...KEEPERS, ...tamskBelowCentre])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        state = skipExtraMove(game, state, W)
        expect(stackAt(state, 'E5')).toEqual([single(W, PieceKind.Tamsk)])
        expect(state.players[0].potentials.tamsk).toBe(6)
        expect(state.activePlayerIds).toEqual([B])
        expect(state.machineState).toBe(MachineState.TakingTurn)
    })

    it("pushing the opponent's TAMSK stack onto E5 gives them an extra move before their move", () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [single(W, PieceKind.Yinsh)]],
            ['E3', [single(W, PieceKind.Yinsh)]],
            ['E4', [pair(B, PieceKind.Tamsk)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        expect(state.machineState).toBe(MachineState.ExtraMove)
        expect(state.activePlayerIds).toEqual([B])
        state = extraMove(game, state, B, 'J1', 'I2')
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
        state = push(game, state, B, 'J4', 'I4', PieceKind.Yinsh)
        expect(state.activePlayerIds).toEqual([W])
    })

    it('an extra move that puts another own TAMSK stack on E5 earns another', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ...tamskBelowCentre,
            ['D5', [pair(W, PieceKind.Tamsk)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        state = extraMove(game, state, W, 'A5', 'B5')
        expect(stackAt(state, 'D5')).toEqual([pair(W, PieceKind.Tamsk)])
        expect(state.activePlayerIds).toEqual([B])
        const chain = withPieces(start(game), [
            ...KEEPERS,
            ...tamskBelowCentre,
            ['B5', [single(B, PieceKind.Yinsh)]],
            ['C5', [single(B, PieceKind.Yinsh)]],
            ['D5', [pair(W, PieceKind.Tamsk)]]
        ])
        state = push(game, chain, W, 'E1', 'E2', PieceKind.Yinsh)
        state = extraMove(game, state, W, 'A5', 'B5')
        expect(stackAt(state, 'E5')).toEqual([pair(W, PieceKind.Tamsk)])
        expect(stackAt(state, 'F4')).toEqual([single(W, PieceKind.Tamsk)])
        expect(state.machineState).toBe(MachineState.ExtraMove)
    })
})

describe('end of game', () => {
    it('capturing the last GIPF piece wins', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS.filter(([, [unit]]) => unit.playerId === W),
            ['E3', [single(W, PieceKind.Yinsh)]],
            ['E4', [single(W, PieceKind.Yinsh)]],
            ['E5', [single(W, PieceKind.Yinsh)]],
            ['E6', [gipf(B)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        state = removeRow(game, state, W, 'E2', 'E5', ['E2'])
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual([W])
        expect(state.endReason).toBe(EndReason.NoGipfPieces)
    })

    it('a player with no move left loses', () => {
        const game = createGame()
        let state = withPieces(start(game), KEEPERS, { [B]: { potentials: potentials(1) } })
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual([W])
        expect(state.endReason).toBe(EndReason.NoMoves)
    })
})

// Every way to remove each row: all singles go, any choice of pairs stays.
function removals(game: MatrxGame, state: MatrxGameState, playerId: string): GameAction[] {
    const board = boardOf(state)
    return board.rowsOf(playerId).flatMap((row) => {
        const pairs = row.reach.filter((coords) => board.topAt(coords)?.paired === true)
        return Array.from({ length: 2 ** pairs.length }, (_, mask) => ({
            ...base(game, playerId),
            type: ActionType.RemoveRow,
            from: row.from,
            to: row.to,
            keep: pairs.filter((_, index) => (mask >> index) & 1)
        })).filter((action) => {
            try {
                execute(game, state, action)
                return true
            } catch {
                return false
            }
        })
    })
}

function legalActions(game: MatrxGame, state: MatrxGameState): GameAction[] {
    const hydrated = new HydratedMatrxGameState(state)
    const playerId = state.activePlayerIds[0]
    const entries = hydrated.board.legalEntries()
    switch (state.machineState) {
        case MachineState.ResolvingRows:
            return removals(game, state, playerId)
        case MachineState.ExtraMove:
            return [
                { ...base(game, playerId), type: ActionType.SkipExtraMove },
                ...entries.map((entry) => ({
                    ...base(game, playerId),
                    type: ActionType.ExtraMove,
                    dot: entry.dot,
                    to: entry.line[0]
                }))
            ]
        default:
            return [
                ...entries.flatMap((entry) =>
                    hydrated.pushableKinds(playerId).map((kind) => ({
                        ...base(game, playerId),
                        type: ActionType.PushPiece,
                        dot: entry.dot,
                        to: entry.line[0],
                        kind
                    }))
                ),
                ...hydrated.potentialMoves(playerId).map((potentialMove) => ({
                    ...base(game, playerId),
                    type: ActionType.MovePotential,
                    ...potentialMove
                }))
            ]
    }
}

describe('random playouts', () => {
    it.each(
        Object.values(BoardShape).flatMap((shape) =>
            Array.from({ length: 12 }, (_, seed) => [shape, seed] as const)
        )
    )('%s board, seed %i, plays to a single winner', (shape, seed) => {
        const game = createGame(shape)
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
            expect(steps).toBeLessThan(5000)
        }
        expect(state.winningPlayerIds).toHaveLength(1)
        expect(state.endReason).toBeDefined()
        const pieces = new HydratedMatrxGameState(state)
        for (const kind of POTENTIAL_KINDS) {
            expect(pieces.players.every((player) => player.potentials[kind] <= 6)).toBe(true)
        }
    })
})

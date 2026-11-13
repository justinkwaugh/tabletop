import { describe, expect, it } from 'vitest'
import {
    assert,
    Color,
    defaultGameConfig,
    GameResult,
    isListConfigOption,
    listOptionDescription,
    type GameConfig
} from '@tabletop/common'
import {
    actionBase,
    createGame,
    engine,
    execute,
    playToEnd,
    type GipfPotentialsGame
} from './tests/playthrough.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import {
    GipfPotentialsConfigurator,
    GipfVersion,
    potentialsFromConfig,
    WhitePlayer
} from './config.js'
import {
    EndReason,
    HydratedGipfPotentialsGameState,
    type GipfPotentialsGameState
} from '../model/gameState.js'
import { emptyBoard } from '../model/board.js'
import { GEOMETRY, pointAt, pointName } from '../model/geometry.js'
import {
    countsOfEachKind,
    PieceKind,
    POTENTIAL_KINDS,
    type PotentialCounts,
    type PotentialKind,
    type Unit
} from '../model/pieces.js'
import type { PushPiece } from '../actions/pushPiece.js'
import type { MovePotential } from '../actions/movePotential.js'
import type { ExtraMove } from '../actions/extraMove.js'
import type { RemoveRow } from '../actions/removeRow.js'

const W = 'white'
const B = 'black'

function start(game: GipfPotentialsGame): GipfPotentialsGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [W, B] } }).initialState
}

const at = pointAt

function push(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState,
    playerId: string,
    dot: string,
    to: string,
    kind: PieceKind
) {
    const action: PushPiece = {
        ...actionBase(game, playerId),
        type: ActionType.PushPiece,
        dot: at(dot),
        to: at(to),
        kind
    }
    return execute(game, state, action)
}

function move(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState,
    playerId: string,
    from: string,
    to: string,
    cover?: number
) {
    const action: MovePotential = {
        ...actionBase(game, playerId),
        type: ActionType.MovePotential,
        from: at(from),
        to: at(to),
        ...(cover === undefined ? {} : { cover })
    }
    return execute(game, state, action)
}

function extraMove(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState,
    playerId: string,
    dot: string,
    to: string
) {
    const action: ExtraMove = {
        ...actionBase(game, playerId),
        type: ActionType.ExtraMove,
        dot: at(dot),
        to: at(to)
    }
    return execute(game, state, action)
}

function skipExtraMove(game: GipfPotentialsGame, state: GipfPotentialsGameState, playerId: string) {
    return execute(game, state, { ...actionBase(game, playerId), type: ActionType.SkipExtraMove })
}

function finishRemoving(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState,
    playerId: string
) {
    return execute(game, state, { ...actionBase(game, playerId), type: ActionType.FinishRemoving })
}

function removeRow(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState,
    playerId: string,
    from: string,
    to: string,
    keep: string[] = []
) {
    const action: RemoveRow = {
        ...actionBase(game, playerId),
        type: ActionType.RemoveRow,
        from: at(from),
        to: at(to),
        keep: keep.map(at)
    }
    return execute(game, state, action)
}

type Piece = Omit<Unit, 'discIds'>
const basic = (playerId: string): Piece => ({ playerId, kind: PieceKind.Basic })
const loaded = (playerId: string, load: PotentialKind): Piece => ({
    playerId,
    kind: PieceKind.Basic,
    load
})
const gipf = (playerId: string): Piece => ({ playerId, kind: PieceKind.Gipf })
const used = (playerId: string, kind: PotentialKind): Piece => ({ playerId, kind })

const potentials = (counts: Partial<PotentialCounts>): PotentialCounts =>
    countsOfEachKind((kind) => counts[kind] ?? 0)

type Reserve = { reserve?: number; potentials?: PotentialCounts; playedOther?: boolean }

// GIPF-pieces out of the way of the tests, so games go on.
const KEEPERS: [string, Piece[]][] = [
    ['B2', [gipf(W)]],
    ['B3', [gipf(W)]],
    ['C2', [gipf(W)]],
    ['H2', [gipf(B)]],
    ['H3', [gipf(B)]],
    ['G2', [gipf(B)]]
]
const whiteKeepers = KEEPERS.filter(([, [piece]]) => piece.playerId === W)

function withPieces(
    state: GipfPotentialsGameState,
    pieces: [string, Piece[]][],
    reserves: Record<string, Reserve> = {}
): GipfPotentialsGameState {
    const next = structuredClone(state)
    next.board = emptyBoard()
    let discId = 1000
    // A later stack on a spot replaces an earlier one, so tests can put pieces over the keepers.
    for (const [name, stack] of new Map(pieces)) {
        const coords = at(name)
        if (!GEOMETRY.isSpot(coords)) throw Error(`${name} is not a spot`)
        next.board.stacks.push({
            coords,
            units: stack.map((piece) => ({
                ...piece,
                discIds: Array.from(
                    { length: piece.kind === PieceKind.Gipf || piece.load !== undefined ? 2 : 1 },
                    () => discId++
                )
            }))
        })
    }
    next.nextDiscId = discId
    for (const player of next.players) {
        const reserve = reserves[player.playerId]
        player.reserve = reserve?.reserve ?? 10
        player.potentials = reserve?.potentials ?? potentials({ [PieceKind.Yinsh]: 6 })
        player.playedOther = reserve?.playedOther ?? true
    }
    return next
}

// Starts black's turn with white's harmless push away from the tests: H4 along the row to E7.
function passWhite(game: GipfPotentialsGame, state: GipfPotentialsGameState) {
    return push(game, state, W, 'I3', 'H4', PieceKind.Yinsh)
}

const hydrated = (state: GipfPotentialsGameState) => new HydratedGipfPotentialsGameState(state)
const stackAt = (state: GipfPotentialsGameState, name: string): Piece[] =>
    hydrated(state)
        .board.stackAt(at(name))
        .map(({ discIds: _discIds, ...piece }) => piece)
const canMove = (state: GipfPotentialsGameState, playerId: string, from: string, to: string) =>
    hydrated(state).isPotentialMove(playerId, at(from), at(to))

describe('the board', () => {
    it('names every point as pointAt reads it', () => {
        for (const coords of GEOMETRY.points) {
            expect(pointAt(pointName(coords))).toEqual(coords)
        }
        expect(pointName(pointAt('I5'))).toBe('I5')
    })
})

describe('setting up', () => {
    it('Standard: three GIPF-pieces each on the board, 12 in reserve, 6 YINSH by default', () => {
        const state = hydrated(start(createGame()))
        expect(state.board.gipfPiecesOf(W)).toBe(3)
        expect(state.board.gipfPiecesOf(B)).toBe(3)
        expect(stackAt(state, 'E2')).toEqual([gipf(W)])
        expect(stackAt(state, 'E8')).toEqual([gipf(B)])
        expect(state.getPlayerState(W).reserve).toBe(12)
        expect(state.getPlayerState(W).potentials).toEqual(potentials({ [PieceKind.Yinsh]: 6 }))
    })

    it('Tournament: an empty board, 18 in reserve, and a GIPF-piece first', () => {
        const game = createGame({ version: GipfVersion.Tournament })
        let state = start(game)
        expect(hydrated(state).board.tops()).toEqual([])
        expect(hydrated(state).getPlayerState(W).reserve).toBe(18)
        expect(hydrated(state).pushableKinds(W)).toEqual([PieceKind.Gipf])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Gipf)
        expect(hydrated(state).pushableKinds(B)).toEqual([PieceKind.Gipf])
        state = push(game, state, B, 'E9', 'E8', PieceKind.Gipf)
        expect(hydrated(state).pushableKinds(W)).toEqual([
            PieceKind.Gipf,
            PieceKind.Yinsh,
            PieceKind.Basic
        ])
        state = push(game, state, W, 'A1', 'B2', PieceKind.Yinsh)
        state = push(game, state, B, 'A5', 'B5', PieceKind.Gipf)
        expect(hydrated(state).pushableKinds(W)).toEqual([PieceKind.Yinsh, PieceKind.Basic])
    })

    it('Ultimate: 21 pieces and 3 potentials of every kind, whatever the counts say', () => {
        const state = hydrated(
            start(createGame({ version: GipfVersion.Ultimate, [PieceKind.Yinsh]: '6' }))
        )
        expect(state.getPlayerState(W).reserve).toBe(21)
        expect(state.getPlayerState(W).potentials).toEqual(countsOfEachKind(() => 3))
    })

    it('chosen counts are kept whatever their total; none at all plays 6 YINSH', () => {
        const every = countsOfEachKind(() => 6)
        expect(
            potentialsFromConfig(Object.fromEntries(POTENTIAL_KINDS.map((k) => [k, '6'])))
        ).toEqual(every)
        expect(
            potentialsFromConfig({
                [PieceKind.Tamsk]: '5',
                [PieceKind.Zertz]: '4',
                [PieceKind.Yinsh]: '0'
            })
        ).toEqual(potentials({ [PieceKind.Tamsk]: 5, [PieceKind.Zertz]: 4 }))
        expect(potentialsFromConfig({ [PieceKind.Yinsh]: '0' })).toEqual(
            potentials({ [PieceKind.Yinsh]: 6 })
        )
    })
})

describe('the White option', () => {
    // Without an assigned order, the White option decides; p2 created the game.
    const firstWith = (whitePlayer: WhitePlayer, creator: string, masterSeed: string) => {
        const game = createGame({ whitePlayer }, ['p1', 'p2'], creator)
        const { initialState } = engine.startGame(game, { masterSeed })
        const [first] = initialState.turnManager.turnOrder
        expect(initialState.players.find((player) => player.playerId === first)?.color).toBe(
            Color.White
        )
        return first
    }
    const seeds = Array.from({ length: 8 }, (_, index) => `${index}`.padStart(32, '0'))

    it('Game creator: the creator plays White and goes first', () => {
        expect(seeds.map((seed) => firstWith(WhitePlayer.Creator, 'p2', seed))).toEqual(
            seeds.map(() => 'p2')
        )
    })

    it('Opponent: the creator plays Black', () => {
        expect(seeds.map((seed) => firstWith(WhitePlayer.Opponent, 'p2', seed))).toEqual(
            seeds.map(() => 'p1')
        )
    })

    it("in a local game, where the creator's user has every seat, the first seat is the creator's", () => {
        for (const [whitePlayer, white] of [
            [WhitePlayer.Creator, 'p1'],
            [WhitePlayer.Opponent, 'p2']
        ] as const) {
            const game = createGame({ whitePlayer }, ['p1', 'p2'])
            game.players = game.players.map((player) => ({ ...player, userId: game.ownerId }))
            const { initialState } = engine.startGame(game, { masterSeed: seeds[0] })
            expect(initialState.turnManager.turnOrder[0]).toBe(white)
        }
    })

    it('White goes to the draw when chosen at random, or when the creator does not play', () => {
        for (const [whitePlayer, creator] of [
            [WhitePlayer.Random, 'p2'],
            [WhitePlayer.Creator, 'someone-else']
        ] as const) {
            const firsts = new Set(seeds.map((seed) => firstWith(whitePlayer, creator, seed)))
            expect(firsts).toEqual(new Set(['p1', 'p2']))
        }
    })
})

describe('the game form', () => {
    const configurator = new GipfPotentialsConfigurator()
    const form = (): GameConfig => defaultGameConfig(configurator.options)
    const counts = (config: GameConfig) => POTENTIAL_KINDS.map((kind) => config[kind])

    it('Ultimate sets every count to 3 and greys them out', () => {
        const config = form()
        configurator.updateConfig(config, { id: 'version', value: GipfVersion.Ultimate })
        expect(counts(config)).toEqual(['3', '3', '3', '3', '3'])
        expect(configurator.isOptionDisabled(config, PieceKind.Yinsh)).toBe(true)
        expect(configurator.isOptionDisabled(config, 'version')).toBe(false)
        configurator.updateConfig(config, { id: 'version', value: GipfVersion.Tournament })
        expect(counts(config)).toEqual(['0', '0', '0', '6', '0'])
        expect(configurator.isOptionDisabled(config, PieceKind.Yinsh)).toBe(false)
    })

    it('describes the version chosen under its menu', () => {
        const version = configurator.options.find((option) => option.id === 'version')
        assert(version !== undefined && isListConfigOption(version), 'Version is a list')
        expect(listOptionDescription(version, GipfVersion.Ultimate)).toContain('21 pieces')
        expect(listOptionDescription(version, GipfVersion.Standard)).toContain('18 pieces')
    })

    it('counts are left as chosen, past 12 in all', () => {
        const config = form()
        for (const kind of POTENTIAL_KINDS)
            configurator.updateConfig(config, { id: kind, value: '5' })
        expect(counts(config)).toEqual(['5', '5', '5', '5', '5'])
        expect(configurator.isOptionDisabled(config, PieceKind.Punct)).toBe(false)
    })
})

describe('loading pieces', () => {
    it('a pushed potential rides on a basic piece', () => {
        const game = createGame()
        const state = push(game, start(game), W, 'A1', 'B2', PieceKind.Yinsh)
        expect(stackAt(state, 'B2')).toEqual([loaded(W, PieceKind.Yinsh)])
        expect(hydrated(state).getPlayerState(W).potentials[PieceKind.Yinsh]).toBe(5)
        expect(hydrated(state).getPlayerState(W).reserve).toBe(11)
    })

    it('a plain piece may be pushed while potentials remain, and they are lost', () => {
        const game = createGame()
        let state = start(game)
        expect(hydrated(state).pushableKinds(W)).toEqual([PieceKind.Yinsh, PieceKind.Basic])
        const action: PushPiece = {
            ...actionBase(game, W),
            type: ActionType.PushPiece,
            dot: at('A1'),
            to: at('B2'),
            kind: PieceKind.Basic
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        state = result.updatedState
        expect(stackAt(state, 'B2')).toEqual([basic(W)])
        expect(hydrated(state).getPlayerState(W).potentials).toEqual(potentials({}))
        expect(hydrated(state).pushableKinds(W)).toEqual([PieceKind.Basic])
        expect(result.processedActions[0]).toMatchObject({
            metadata: { forfeited: potentials({ [PieceKind.Yinsh]: 6 }) }
        })
    })
})

describe('potentials', () => {
    it('YINSH slides along empty spots, never onto a dot, and leaves a plain piece behind', () => {
        const game = createGame()
        const state = withPieces(start(game), [
            ...KEEPERS,
            ['E3', [loaded(W, PieceKind.Yinsh)]],
            ['E7', [basic(B)]]
        ])
        expect(canMove(state, W, 'E3', 'E6')).toBe(true)
        expect(canMove(state, W, 'E3', 'E7')).toBe(false)
        expect(canMove(state, W, 'E3', 'E2')).toBe(true)
        expect(canMove(state, W, 'E3', 'E1')).toBe(false)
        const next = move(game, state, W, 'E3', 'E6')
        expect(stackAt(next, 'E3')).toEqual([basic(W)])
        expect(stackAt(next, 'E6')).toEqual([used(W, PieceKind.Yinsh)])
    })

    it('ZÈRTZ jumps a line of adjacent pieces to the first empty spot, never onto a dot', () => {
        const game = createGame()
        const state = withPieces(start(game), [
            ...KEEPERS,
            ['E3', [loaded(W, PieceKind.Zertz)]],
            ['E4', [basic(B)]],
            ['E5', [gipf(W)]],
            ['D3', [basic(B)]],
            ['C3', [basic(B)]]
        ])
        expect(canMove(state, W, 'E3', 'E6')).toBe(true)
        expect(canMove(state, W, 'E3', 'E7')).toBe(false)
        expect(canMove(state, W, 'E3', 'E2')).toBe(false)
        expect(hydrated(state).board.potentialTargets(at('E3'), 10)).toHaveLength(1)
        const next = move(game, state, W, 'E3', 'E6')
        expect(stackAt(next, 'E4')).toEqual([basic(B)])
        expect(stackAt(next, 'E6')).toEqual([used(W, PieceKind.Zertz)])
    })

    it('DVONN covers an adjacent basic piece or DVONN of the opponent, and takes the spot', () => {
        const game = createGame()
        const around = (target: Piece[]) =>
            withPieces(start(game), [
                ...KEEPERS,
                ['E3', [loaded(W, PieceKind.Dvonn)]],
                ['E4', target]
            ])
        expect(canMove(around([basic(B)]), W, 'E3', 'E4')).toBe(true)
        expect(canMove(around([loaded(B, PieceKind.Dvonn)]), W, 'E3', 'E4')).toBe(true)
        expect(canMove(around([basic(W), used(B, PieceKind.Dvonn)]), W, 'E3', 'E4')).toBe(true)
        expect(canMove(around([gipf(B)]), W, 'E3', 'E4')).toBe(false)
        expect(canMove(around([loaded(B, PieceKind.Tamsk)]), W, 'E3', 'E4')).toBe(false)
        expect(canMove(around([used(B, PieceKind.Yinsh)]), W, 'E3', 'E4')).toBe(false)
        expect(canMove(around([basic(W)]), W, 'E3', 'E4')).toBe(false)
        const next = move(game, around([basic(B)]), W, 'E3', 'E4')
        expect(stackAt(next, 'E4')).toEqual([basic(B), used(W, PieceKind.Dvonn)])
        expect(hydrated(next).board.topAt(at('E4'))?.playerId).toBe(W)
    })

    it('DVONN may cover the opponent’s single that covers your own GIPF-piece', () => {
        const game = createGame()
        const state = withPieces(start(game), [
            ...KEEPERS,
            ['E3', [loaded(W, PieceKind.Dvonn)]],
            ['E4', [gipf(W), basic(B)]]
        ])
        const next = move(game, state, W, 'E3', 'E4')
        expect(stackAt(next, 'E4')).toEqual([gipf(W), basic(B), used(W, PieceKind.Dvonn)])
        expect(hydrated(next).board.gipfPiecesOf(W)).toBe(3)
    })

    it('PÜNCT covers a GIPF-piece with one or two pieces from the reserve, and leaves the game', () => {
        const game = createGame()
        const state = withPieces(start(game), [
            ...KEEPERS,
            ['E3', [loaded(W, PieceKind.Punct)]],
            ['E4', [gipf(B)]]
        ])
        const single = move(game, state, W, 'E3', 'E4', 1)
        expect(stackAt(single, 'E4')).toEqual([gipf(B), basic(W)])
        expect(hydrated(single).getPlayerState(W).reserve).toBe(9)
        expect(hydrated(single).board.gipfPiecesOf(B)).toBe(3)
        const double = move(game, state, W, 'E3', 'E4', 2)
        expect(stackAt(double, 'E4')).toEqual([gipf(B), gipf(W)])
        expect(hydrated(double).board.gipfPiecesOf(W)).toBe(4)
        expect(() => move(game, state, W, 'E3', 'E4')).toThrow()
        const noReserve = withPieces(
            start(game),
            [...KEEPERS, ['E3', [loaded(W, PieceKind.Punct)]], ['E4', [gipf(B)]]],
            { [W]: { reserve: 0 } }
        )
        expect(canMove(noReserve, W, 'E3', 'E4')).toBe(false)
    })

    it('PÜNCT covers the opponent’s PÜNCT, loaded or used, but no basic piece', () => {
        const game = createGame()
        const around = (target: Piece[]) =>
            withPieces(start(game), [
                ...KEEPERS,
                ['E3', [loaded(W, PieceKind.Punct)]],
                ['E4', target]
            ])
        expect(canMove(around([loaded(B, PieceKind.Punct)]), W, 'E3', 'E4')).toBe(true)
        expect(
            canMove(around([loaded(W, PieceKind.Punct), used(B, PieceKind.Punct)]), W, 'E3', 'E4')
        ).toBe(true)
        expect(canMove(around([basic(B)]), W, 'E3', 'E4')).toBe(false)
        expect(canMove(around([gipf(W), basic(B)]), W, 'E3', 'E4')).toBe(false)
        const next = move(game, around([loaded(B, PieceKind.Punct)]), W, 'E3', 'E4')
        expect(stackAt(next, 'E4')).toEqual([loaded(B, PieceKind.Punct), used(W, PieceKind.Punct)])
    })

    it('covering the last GIPF-piece wins at the end of the turn', () => {
        const game = createGame()
        const state = withPieces(start(game), [
            ...whiteKeepers,
            ['E3', [loaded(W, PieceKind.Punct)]],
            ['E4', [gipf(B)]]
        ])
        const next = move(game, state, W, 'E3', 'E4', 1)
        expect(next.machineState).toBe(MachineState.EndOfGame)
        expect(next.winningPlayerIds).toEqual([W])
        expect(next.endReason).toBe(EndReason.NoGipfPieces)
    })

    it('but not if the covering piece is taken in a row the same turn', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...whiteKeepers,
            ['E3', [loaded(W, PieceKind.Punct)]],
            ['E4', [gipf(B)]],
            ['E5', [basic(W)]],
            ['E6', [basic(W)]],
            ['E7', [basic(W)]]
        ])
        state = move(game, state, W, 'E3', 'E4', 1)
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        state = removeRow(game, state, W, 'E3', 'E7')
        expect(stackAt(state, 'E4')).toEqual([gipf(B)])
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
    })
})

describe('TAMSK', () => {
    // Pushing in at E2 carries the TAMSK-loaded piece on E4 onto the centre and lines up E2–E5.
    const tamskBelowCentre: [string, Piece[]][] = [
        ['E2', [basic(W)]],
        ['E3', [basic(W)]],
        ['E4', [loaded(W, PieceKind.Tamsk)]]
    ]

    it('pushed onto the centre: an extra move at once, before any row is taken', () => {
        const game = createGame()
        let state = withPieces(start(game), [...KEEPERS, ...tamskBelowCentre])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        expect(state.machineState).toBe(MachineState.ExtraMove)
        expect(state.activePlayerIds).toEqual([W])
        state = extraMove(game, state, W, 'A5', 'B5')
        expect(stackAt(state, 'B5')).toEqual([used(W, PieceKind.Tamsk)])
        expect(stackAt(state, 'E5')).toEqual([basic(W)])
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([W])
    })

    it('an extra move not made loses the potential', () => {
        const game = createGame()
        let state = withPieces(start(game), [...KEEPERS, ...tamskBelowCentre])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        state = skipExtraMove(game, state, W)
        expect(stackAt(state, 'E5')).toEqual([basic(W)])
        expect(state.machineState).toBe(MachineState.ResolvingRows)
    })

    it('pushed onto the centre by the opponent: the extra move opens its owner’s turn', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [basic(W)]],
            ['E3', [basic(B)]],
            ['E4', [loaded(W, PieceKind.Tamsk)]]
        ])
        state = passWhite(game, state)
        state = push(game, state, B, 'E1', 'E2', PieceKind.Yinsh)
        expect(state.machineState).toBe(MachineState.ExtraMove)
        expect(state.activePlayerIds).toEqual([W])
        state = extraMove(game, state, W, 'A5', 'B5')
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([W])
    })

    it('an extra move the opponent gave is made only if the piece still stands on the centre', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [basic(W)]],
            ['E3', [basic(W)]],
            ['E4', [loaded(W, PieceKind.Tamsk)]],
            ['E6', [basic(W)]]
        ])
        state = passWhite(game, state)
        // Black's push lines up White's E3–E6 with the TAMSK piece on the centre: a four with a
        // loaded piece, which White must break before the turn ends.
        state = push(game, state, B, 'E1', 'E2', PieceKind.Yinsh)
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([W])
        state = removeRow(game, state, W, 'E3', 'E6')
        expect(stackAt(state, 'E5')).toEqual([])
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([W])
        expect(state.extraMoveOwedIds).toEqual([])
    })

    it('rows an extra move makes before the regular move wait for the regular move', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['B4', [basic(W)]],
            ['E2', [basic(W)]],
            ['E3', [basic(B)]],
            ['E4', [loaded(W, PieceKind.Tamsk)]]
        ])
        state = passWhite(game, state)
        state = push(game, state, B, 'E1', 'E2', PieceKind.Yinsh)
        expect(state.machineState).toBe(MachineState.ExtraMove)
        // The used TAMSK lands on B5 and completes White's B2–B5, which must go.
        state = extraMove(game, state, W, 'B6', 'B5')
        expect(hydrated(state).board.rowsOf(W)).toHaveLength(1)
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([W])
        state = passWhite(game, state)
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([W])
    })
})

describe('taking rows', () => {
    it('loaded pieces may stay, plain pieces may not', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [basic(W)]],
            ['E3', [loaded(W, PieceKind.Yinsh)]],
            ['E4', [basic(W)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        expect(() => removeRow(game, state, W, 'E2', 'E5', ['E3'])).toThrow()
        state = removeRow(game, state, W, 'E2', 'E5', ['E2', 'E4'])
        expect(stackAt(state, 'E4')).toEqual([loaded(W, PieceKind.Yinsh)])
        expect(stackAt(state, 'E3')).toEqual([])
        expect(hydrated(state).getPlayerState(W).reserve).toBe(11)
    })

    it('a four of loaded and GIPF-pieces must be broken', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [gipf(W)]],
            ['E3', [loaded(W, PieceKind.Yinsh)]],
            ['E4', [gipf(W)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        expect(() => finishRemoving(game, state, W)).toThrow()
        expect(() => removeRow(game, state, W, 'E2', 'E5', ['E2', 'E3', 'E4', 'E5'])).toThrow()
        state = removeRow(game, state, W, 'E2', 'E5', ['E2', 'E3', 'E5'])
        expect(stackAt(state, 'E4')).toEqual([])
        expect(hydrated(state).getPlayerState(W).reserve).toBe(10)
    })

    it('a four of GIPF-pieces alone may stay', () => {
        const game = createGame({ version: GipfVersion.Tournament })
        let state = withPieces(
            start(game),
            [...KEEPERS, ['E2', [gipf(W)]], ['E3', [gipf(W)]], ['E4', [gipf(W)]]],
            { [W]: { playedOther: false } }
        )
        state.turnManager.turnCounts = { [W]: 1, [B]: 1 }
        state = push(game, state, W, 'E1', 'E2', PieceKind.Gipf)
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        state = finishRemoving(game, state, W)
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('used potentials go; own pieces return to the reserve, the opponent’s are captured and their potentials leave the game', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [used(W, PieceKind.Zertz)]],
            ['E3', [basic(W)]],
            ['E4', [basic(W)]],
            ['E6', [loaded(B, PieceKind.Yinsh)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        expect(() => removeRow(game, state, W, 'E2', 'E5', ['E3'])).toThrow()
        state = removeRow(game, state, W, 'E2', 'E5', ['E2'])
        const white = hydrated(state).getPlayerState(W)
        expect(white.reserve).toBe(11)
        expect(white.captured).toBe(1)
    })

    it('a freed piece completing a row of the remover’s colour is taken too', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [basic(W)]],
            ['E3', [basic(W)]],
            ['E4', [basic(W)]],
            ['E6', [basic(W), used(B, PieceKind.Dvonn)]],
            ['F5', [basic(W)]],
            ['G4', [basic(W)]],
            ['H3', [basic(W)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        state = removeRow(game, state, W, 'E2', 'E5', ['E2'])
        expect(stackAt(state, 'E6')).toEqual([basic(W)])
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([W])
        state = removeRow(game, state, W, 'E6', 'H3')
        expect(state.activePlayerIds).toEqual([B])
    })

    it('a row freed by taking a row of GIPF-pieces before your move waits until after it', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [gipf(W)]],
            ['E3', [gipf(W)]],
            ['E4', [gipf(W)]],
            ['E5', [gipf(B), gipf(W)]],
            ['F4', [basic(B)]],
            ['G3', [basic(B)]],
            ['H2', [basic(B)]]
        ])
        state = removeRow(game, state, W, 'E2', 'E5')
        expect(stackAt(state, 'E5')).toEqual([gipf(B)])
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([W])
        state = push(game, state, W, 'A1', 'B2', PieceKind.Yinsh)
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([B])
    })
})

describe('rows of the player not moving', () => {
    const blackKeepers = KEEPERS.filter(([, [piece]]) => piece.playerId === B)

    it('a row of GIPF-pieces alone waits for its owner, even beside a row that must go', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...whiteKeepers,
            ['D2', [gipf(B)]],
            ['D3', [gipf(B)]],
            ['D4', [gipf(B)]],
            ['D5', [gipf(B)]],
            ['F2', [basic(B)]],
            ['F3', [basic(B)]],
            ['F4', [basic(B)]],
            ['F5', [basic(B)]]
        ])
        state = passWhite(game, state)
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([B])
        expect(() => removeRow(game, state, B, 'D2', 'D5')).toThrow()
        state = removeRow(game, state, B, 'F2', 'F5')
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
        state = removeRow(game, state, B, 'D2', 'D5')
        expect(stackAt(state, 'D2')).toEqual([])
    })

    it('a row the mover’s removal uncovers for the opponent is the opponent’s to take at once', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...KEEPERS,
            ['E2', [basic(W)]],
            ['E3', [basic(W)]],
            ['E4', [basic(W)]],
            ['E6', [basic(B), used(W, PieceKind.Dvonn)]],
            ['F5', [basic(B)]],
            ['G4', [basic(B)]],
            ['H3', [basic(B)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        state = removeRow(game, state, W, 'E2', 'E6', ['E2'])
        expect(stackAt(state, 'E6')).toEqual([basic(B)])
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('a row the opponent’s removal uncovers for the mover waits until after the opponent’s move', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...whiteKeepers,
            ...blackKeepers,
            ['E2', [basic(B)]],
            ['E3', [basic(B)]],
            ['E4', [basic(B)]],
            ['E5', [basic(B)]],
            ['E6', [basic(W), used(B, PieceKind.Dvonn)]],
            ['F5', [basic(W)]],
            ['G4', [basic(W)]],
            ['H3', [basic(W)]]
        ])
        state = passWhite(game, state)
        expect(state.activePlayerIds).toEqual([B])
        state = removeRow(game, state, B, 'E2', 'E6')
        expect(stackAt(state, 'E6')).toEqual([basic(W)])
        expect(hydrated(state).board.rowsOf(W)).toHaveLength(1)
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
        state = push(game, state, B, 'E9', 'E8', PieceKind.Yinsh)
        expect(state.machineState).toBe(MachineState.ResolvingRows)
        expect(state.activePlayerIds).toEqual([W])
    })
})

describe('end of game', () => {
    it('a turn that leaves neither player a GIPF-piece is won by the mover', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ['E2', [basic(W)]],
            ['E3', [gipf(W)]],
            ['E4', [basic(W)]],
            ['E6', [gipf(B)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        state = removeRow(game, state, W, 'E2', 'E5')
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual([W])
        expect(state.endReason).toBe(EndReason.NoGipfPieces)
    })

    it('taking the last GIPF-piece wins', () => {
        const game = createGame()
        let state = withPieces(start(game), [
            ...whiteKeepers,
            ['E3', [basic(W)]],
            ['E4', [basic(W)]],
            ['E5', [basic(W)]],
            ['E6', [gipf(B)]]
        ])
        state = push(game, state, W, 'E1', 'E2', PieceKind.Yinsh)
        state = removeRow(game, state, W, 'E2', 'E5', ['E2'])
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual([W])
        expect(state.endReason).toBe(EndReason.NoGipfPieces)
    })

    it('a player with no piece and no potential to use loses', () => {
        const game = createGame()
        let state = withPieces(start(game), KEEPERS, { [B]: { reserve: 0 } })
        state = passWhite(game, state)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual([W])
        expect(state.endReason).toBe(EndReason.NoMoves)
    })

    it('but plays on with a potential it can use', () => {
        const game = createGame()
        let state = withPieces(
            start(game),
            [...KEEPERS, ['D5', [loaded(B, PieceKind.Zertz)]], ['D6', [basic(W)]]],
            { [B]: { reserve: 0 } }
        )
        state = passWhite(game, state)
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([B])
    })
})

const PLAYOUTS: [string, GameConfig][] = [
    ['Standard, 6 YINSH', {}],
    ['Standard, 6 of every kind', Object.fromEntries(POTENTIAL_KINDS.map((kind) => [kind, '6']))],
    [
        'Standard, TAMSK, DVONN and PÜNCT',
        {
            [PieceKind.Tamsk]: '4',
            [PieceKind.Dvonn]: '4',
            [PieceKind.Yinsh]: '0',
            [PieceKind.Punct]: '4'
        }
    ],
    [
        'Tournament, ZÈRTZ and PÜNCT',
        {
            version: GipfVersion.Tournament,
            [PieceKind.Zertz]: '6',
            [PieceKind.Yinsh]: '0',
            [PieceKind.Punct]: '6'
        }
    ],
    ['Ultimate', { version: GipfVersion.Ultimate }]
]

describe('random playouts', () => {
    it.each(
        PLAYOUTS.flatMap(([name, config]) =>
            Array.from({ length: 12 }, (_, seed) => [name, seed, config] as const)
        )
    )('%s, seed %i, plays to a single winner', (_name, seed, config) => {
        const game = createGame(config)
        const state = playToEnd(game, start(game), seed)
        expect(state.winningPlayerIds).toHaveLength(1)
        expect(state.endReason).toBeDefined()
    })
})

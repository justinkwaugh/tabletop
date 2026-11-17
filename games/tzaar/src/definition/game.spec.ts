import { describe, expect, it } from 'vitest'
import { assert, Color, GameResult, type GameAction } from '@tabletop/common'
import { TzaarRuntime } from './runtime.js'
import { TzaarVersion, versionFromConfig, WhitePlayer, whitePlayerFromConfig } from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { HydratedTzaarGameState, type TzaarGameState } from '../model/gameState.js'
import { SPACES } from '../model/geometry.js'
import { spaceFromName, spaceName } from '../model/notation.js'
import { PIECE_KINDS, PIECES_OF_KIND, PieceKind, type Piece } from '../model/board.js'
import { FIXED_START } from '../model/startPositions.js'
import { isCapture, type Capture } from '../actions/capture.js'
import { isStack, type Stack } from '../actions/stack.js'
import { isPass, type Pass } from '../actions/pass.js'
import { isPlacePiece, type PlacePiece } from '../actions/placePiece.js'
import {
    actionBase as base,
    createGame as createTestGame,
    engine,
    execute,
    MASTER_SEED,
    playToEnd,
    type TzaarConfig,
    type TzaarGame
} from './tests/playthrough.js'

const W = 'white'
const B = 'black'

type Owner = { ownerId: string; userIds: Record<string, string> }

function createGame(config: TzaarConfig = {}, owner?: Owner) {
    return createTestGame(config, [W, B], owner)
}

// A distinct fixed master seed for each number.
function masterSeed(number: number): string {
    return number.toString(16).padStart(32, '0')
}

function start(game: TzaarGame, seed: string = MASTER_SEED): TzaarGameState {
    return engine.startGame(game, {
        masterSeed: seed,
        startingPositions: { playerIds: [W, B] }
    }).initialState
}

function startUnassigned(game: TzaarGame, seed: string = MASTER_SEED): TzaarGameState {
    return engine.startGame(game, { masterSeed: seed }).initialState
}

function processed(game: TzaarGame, state: TzaarGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).processedActions[0]
}

function captureMetadata(game: TzaarGame, state: TzaarGameState, from: string, to: string) {
    const action = processed(game, state, captureAction(game, W, from, to))
    assert(isCapture(action), 'The capture is processed')
    return action.metadata
}

function passMetadata(game: TzaarGame, state: TzaarGameState) {
    const action = processed(game, state, passAction(game, W))
    assert(isPass(action), 'The pass is processed')
    return action.metadata
}

const s = spaceFromName

function placeAction(game: TzaarGame, playerId: string, name: string, kind: PieceKind): PlacePiece {
    return { ...base(game, playerId), type: ActionType.PlacePiece, coords: s(name), kind }
}

function captureAction(game: TzaarGame, playerId: string, from: string, to: string): Capture {
    return { ...base(game, playerId), type: ActionType.Capture, from: s(from), to: s(to) }
}

function stackAction(game: TzaarGame, playerId: string, from: string, to: string): Stack {
    return { ...base(game, playerId), type: ActionType.Stack, from: s(from), to: s(to) }
}

function passAction(game: TzaarGame, playerId: string): Pass {
    return { ...base(game, playerId), type: ActionType.Pass }
}

const KIND_LETTERS: Record<string, PieceKind> = {
    r: PieceKind.Tzaar,
    a: PieceKind.Tzarra,
    t: PieceKind.Tott
}

function pieces(letters: string, firstId: number): Piece[] {
    return letters.split('').map((letter, index) => ({
        id: firstId + index,
        playerId: letter === letter.toUpperCase() ? W : B,
        kind: KIND_LETTERS[letter.toLowerCase()]
    }))
}

// Stacks read bottom to top: R Tzaar, A Tzarra, T Tott; capitals are White's, lower case
// Black's. Every other space is empty and White makes the first capture of a turn.
function position(game: TzaarGame, stacks: Record<string, string>): TzaarGameState {
    const state = start(createGame({ version: TzaarVersion.Fixed }))
    let id = 0
    state.board.stacks = Object.entries(stacks).map(([name, letters]) => {
        const stack = { coords: s(name), pieces: pieces(letters, id) }
        id += letters.length
        return stack
    })
    return { ...state, gameId: game.id }
}

function stackAt(state: TzaarGameState, name: string): string {
    return new HydratedTzaarGameState(state).board
        .stackAt(s(name))
        .map((piece) => {
            const letter = { tzaar: 'r', tzarra: 'a', tott: 't' }[piece.kind]
            return piece.playerId === W ? letter.toUpperCase() : letter
        })
        .join('')
}

const BLACK_KIT = { G7: 'r', H6: 'a', I5: 't' }

describe('board', () => {
    it('has 60 spaces in columns A–I, column E skipping the centre', () => {
        expect(SPACES).toHaveLength(60)
        const names = SPACES.map(spaceName)
        expect(new Set(names).size).toBe(60)
        const tops = 'ABCDEFGHI'
            .split('')
            .map((letter) =>
                Math.max(
                    ...names
                        .filter((name) => name[0] === letter)
                        .map((name) => Number(name.slice(1)))
                )
            )
        expect(tops).toEqual([5, 6, 7, 8, 8, 8, 7, 6, 5])
        expect(spaceName({ q: 0, r: 1 })).toBe('E4')
        expect(spaceName({ q: 0, r: -1 })).toBe('E5')
        names.forEach((name) => expect(spaceName(spaceFromName(name))).toBe(name))
    })
})

describe('setups', () => {
    it('starts the fixed position as diagram 4, symmetrical, with White to capture', () => {
        const state = start(createGame({ version: TzaarVersion.Fixed }))
        expect(state.machineState).toBe(MachineState.Capturing)
        expect(state.activePlayerIds).toEqual([W])
        expect(stackAt(state, 'C5')).toBe('R')
        expect(stackAt(state, 'E8')).toBe('t')
        expect(stackAt(state, 'H3')).toBe('A')
        for (const piece of FIXED_START) {
            const opposite = FIXED_START.find(
                (other) => other.coords.q === -piece.coords.q && other.coords.r === -piece.coords.r
            )
            expect(opposite?.white).toBe(!piece.white)
            expect(opposite?.kind).toBe(piece.kind)
        }
    })

    it.each([TzaarVersion.Random, TzaarVersion.Fixed])(
        '%s start fills every space with 6 Tzaars, 9 Tzarras and 15 Totts each',
        (version) => {
            const state = new HydratedTzaarGameState(start(createGame({ version })))
            expect(state.board.isFull()).toBe(true)
            for (const playerId of [W, B]) {
                expect(PIECE_KINDS.map((kind) => state.board.topsOf(playerId, kind))).toEqual([
                    6, 9, 15
                ])
            }
            expect(state.board.stacks.every((stack) => stack.pieces.length === 1)).toBe(true)
            const ids = state.board.stacks.map((stack) => stack.pieces[0].id)
            expect(new Set(ids).size).toBe(60)
        }
    )

    it('gives White to the game creator or the opponent when chosen', () => {
        const owner = { ownerId: 'u-black', userIds: { [W]: 'u-white', [B]: 'u-black' } }
        const creatorWhite = startUnassigned(
            createGame({ whitePlayer: WhitePlayer.Creator }, owner)
        )
        const whiteOf = (state: TzaarGameState) =>
            state.players.find((player) => player.color === Color.White)?.playerId
        expect(whiteOf(creatorWhite)).toBe(B)
        expect(creatorWhite.activePlayerIds).toEqual([B])
        const opponentWhite = startUnassigned(
            createGame({ whitePlayer: WhitePlayer.Opponent }, owner)
        )
        expect(whiteOf(opponentWhite)).toBe(W)
    })
})

describe('tournament placement', () => {
    it('starts empty; White places first, then the players alternate', () => {
        const game = createGame({ version: TzaarVersion.Tournament })
        let state = start(game)
        expect(state.machineState).toBe(MachineState.PlacingPieces)
        expect(state.board.stacks).toEqual([])
        expect(state.activePlayerIds).toEqual([W])
        state = execute(game, state, placeAction(game, W, 'E4', PieceKind.Tzaar))
        expect(state.activePlayerIds).toEqual([B])
        expect(() => execute(game, state, placeAction(game, B, 'E4', PieceKind.Tott))).toThrow()
    })

    it('refuses a kind the player has no more of, and opens play once the board is full', () => {
        const game = createGame({ version: TzaarVersion.Tournament })
        let state = start(game)
        const kinds = [true, false].map(() =>
            PIECE_KINDS.flatMap((kind) => Array.from({ length: PIECES_OF_KIND[kind] }, () => kind))
        )
        SPACES.forEach((coords, index) => {
            const playerId = index % 2 === 0 ? W : B
            const kind = kinds[index % 2][Math.floor(index / 2)]
            if (index === 12) {
                expect(() =>
                    execute(game, state, placeAction(game, W, spaceName(coords), PieceKind.Tzaar))
                ).toThrow()
            }
            state = execute(game, state, placeAction(game, playerId, spaceName(coords), kind))
        })
        expect(state.machineState).toBe(MachineState.Capturing)
        expect(state.activePlayerIds).toEqual([W])
    })
})

describe('capturing', () => {
    it('opens with a single capture by White, then Black captures first', () => {
        const game = createGame({ version: TzaarVersion.Fixed })
        const state = start(game)
        expect(captureMetadata(game, state, 'A5', 'A4')).toMatchObject({ opening: true })
        const next = execute(game, state, captureAction(game, W, 'A5', 'A4'))
        expect(stackAt(next, 'A4')).toBe('T')
        expect(stackAt(next, 'A5')).toBe('')
        expect(next.machineState).toBe(MachineState.Capturing)
        expect(next.activePlayerIds).toEqual([B])
    })

    it('captures along a line over vacant spaces, never onto an empty space, over a piece or across the centre', () => {
        const game = createGame()
        const state = position(game, {
            ...BLACK_KIT,
            A1: 'R',
            A4: 'a',
            A5: 't',
            E4: 'T',
            E5: 't',
            I1: 'A'
        })
        expect(stackAt(execute(game, state, captureAction(game, W, 'A1', 'A4')), 'A4')).toBe('R')
        expect(() => execute(game, state, captureAction(game, W, 'A1', 'A2'))).toThrow()
        expect(() => execute(game, state, captureAction(game, W, 'A1', 'A5'))).toThrow()
        expect(() => execute(game, state, captureAction(game, W, 'E4', 'E5'))).toThrow()
        expect(() => execute(game, state, stackAction(game, W, 'A1', 'I1'))).toThrow()
        expect(() => execute(game, state, passAction(game, W))).toThrow()
    })

    it('captures stacks no higher than the capturing one, whatever their type', () => {
        const game = createGame()
        const state = position(game, {
            ...BLACK_KIT,
            A1: 'T',
            A2: 'tt',
            B2: 'RT',
            C1: 't',
            D1: 'R',
            D2: 'A',
            E1: 'rrr'
        })
        expect(() => execute(game, state, captureAction(game, W, 'A1', 'A2'))).toThrow()
        expect(stackAt(execute(game, state, captureAction(game, W, 'B2', 'A2')), 'A2')).toBe('RT')
        expect(captureMetadata(game, state, 'B2', 'A2')).toEqual({
            moved: { height: 2, kind: PieceKind.Tott },
            captured: { height: 2, kind: PieceKind.Tott }
        })
        expect(stackAt(execute(game, state, captureAction(game, W, 'D1', 'C1')), 'C1')).toBe('R')
        expect(() => execute(game, state, captureAction(game, W, 'D1', 'E1'))).toThrow()
    })
})

describe('the second move', () => {
    const game = createGame()
    const afterCapture = execute(
        game,
        position(game, {
            ...BLACK_KIT,
            A1: 'R',
            A2: 'T',
            A3: 'A',
            A5: 't',
            B1: 'T',
            C2: 't'
        }),
        captureAction(game, W, 'A3', 'A5')
    )

    it('follows the forced capture in the same turn', () => {
        expect(afterCapture.machineState).toBe(MachineState.SecondMove)
        expect(afterCapture.activePlayerIds).toEqual([W])
    })

    it('can be a second capture, with the same piece or another', () => {
        const next = execute(game, afterCapture, captureAction(game, W, 'B1', 'C2'))
        expect(stackAt(next, 'C2')).toBe('T')
        expect(next.activePlayerIds).toEqual([B])
        expect(next.machineState).toBe(MachineState.Capturing)
    })

    it('can stack onto one of the player’s own stacks, the top piece giving its type', () => {
        const next = execute(game, afterCapture, stackAction(game, W, 'A1', 'A2'))
        expect(stackAt(next, 'A2')).toBe('TR')
        expect(stackAt(next, 'A1')).toBe('')
        expect(next.activePlayerIds).toEqual([B])
        const stacked = processed(game, afterCapture, stackAction(game, W, 'A1', 'A2'))
        assert(isStack(stacked), 'The stacking is processed')
        expect(stacked.metadata).toEqual({
            moved: { height: 1, kind: PieceKind.Tzaar },
            landedOnHeight: 1
        })
    })

    it('never covers the player’s last top piece of a type', () => {
        expect(() => execute(game, afterCapture, stackAction(game, W, 'A2', 'A1'))).toThrow()
        expect(() => execute(game, afterCapture, stackAction(game, W, 'A2', 'A5'))).toThrow()
        expect(() => execute(game, afterCapture, stackAction(game, W, 'B1', 'A1'))).toThrow()
        const hydrated = new HydratedTzaarGameState(afterCapture)
        expect(
            hydrated
                .stackings(W)
                .map(({ from, to }) => `${spaceName(from)}-${spaceName(to)}`)
                .sort()
        ).toEqual(['A1-A2', 'A1-B1', 'A5-A2'])
    })

    it('can be a pass', () => {
        const next = execute(game, afterCapture, passAction(game, W))
        expect(next.activePlayerIds).toEqual([B])
        expect(next.machineState).toBe(MachineState.Capturing)
    })

    it('is skipped when the player has nothing to capture or stack', () => {
        const state = position(game, {
            I5: 'rr',
            I4: 'aa',
            I3: 'tt',
            A1: 'T',
            A2: 't',
            C1: 'R',
            D1: 'A'
        })
        expect(captureMetadata(game, state, 'A1', 'A2')).toMatchObject({ noSecondMove: true })
        const next = execute(game, state, captureAction(game, W, 'A1', 'A2'))
        expect(next.activePlayerIds).toEqual([B])
        expect(next.machineState).toBe(MachineState.Capturing)
    })
})

describe('the end', () => {
    it('is won at once by taking the last top piece of a type, buried ones not counting', () => {
        const game = createGame()
        const state = position(game, {
            A1: 'R',
            A2: 'r',
            A3: 'rt',
            H6: 'a',
            I5: 't',
            I1: 'A',
            I2: 'T'
        })
        expect(captureMetadata(game, state, 'A1', 'A2')).toMatchObject({
            eliminatedKind: PieceKind.Tzaar
        })
        const next = execute(game, state, captureAction(game, W, 'A1', 'A2'))
        expect(next.machineState).toBe(MachineState.EndOfGame)
        expect(next.result).toBe(GameResult.Win)
        expect(next.winningPlayerIds).toEqual([W])
    })

    it('is won when the opponent cannot capture as their turn begins', () => {
        const game = createGame()
        const state = execute(
            game,
            position(game, {
                I5: 'RR',
                I4: 'AA',
                I3: 'TT',
                A5: 'r',
                B6: 'a',
                C7: 't',
                A1: 't'
            }),
            captureAction(game, W, 'I3', 'C7')
        )
        expect(passMetadata(game, state)).toEqual({ stuckPlayerId: B })
        const next = execute(game, state, passAction(game, W))
        expect(next.machineState).toBe(MachineState.EndOfGame)
        expect(next.winningPlayerIds).toEqual([W])
    })

    it('records the type taken and wins, even when the opponent is also left unable to capture', () => {
        const game = createGame()
        const state = position(game, {
            A1: 'R',
            A2: 'r',
            I5: 'a',
            I4: 't',
            H6: 'AA',
            H5: 'TT',
            H4: 'TT',
            I3: 'AA'
        })
        expect(captureMetadata(game, state, 'A1', 'A2')).toEqual({
            moved: { height: 1, kind: PieceKind.Tzaar },
            captured: { height: 1, kind: PieceKind.Tzaar },
            eliminatedKind: PieceKind.Tzaar
        })
        const next = execute(game, state, captureAction(game, W, 'A1', 'A2'))
        expect(new HydratedTzaarGameState(next).canCapture(B)).toBe(false)
        expect(next.machineState).toBe(MachineState.EndOfGame)
        expect(next.winningPlayerIds).toEqual([W])
        expect(TzaarRuntime.scoring?.finalScores(next)).toEqual({ [W]: 1, [B]: 0 })
    })

    // With every stack one piece high no placement order leaves White without a capture, so the
    // board is set by hand around White's single Tzaar.
    it('is won by Black when the last tournament placement leaves White unable to capture', () => {
        const game = createGame({ version: TzaarVersion.Tournament })
        const placed = execute(game, start(game), placeAction(game, W, 'A1', PieceKind.Tzaar))
        const last = s('I5')
        let id = placed.board.stacks.length
        const blackStacks = SPACES.filter(
            (coords) => spaceName(coords) !== 'A1' && spaceName(coords) !== 'I5'
        ).map((coords) => {
            const stack = { coords, pieces: pieces('tt', id) }
            id += 2
            return stack
        })
        const state = { ...placed, board: { stacks: [...placed.board.stacks, ...blackStacks] } }
        expect(state.activePlayerIds).toEqual([B])

        const placement = placeAction(game, B, spaceName(last), PieceKind.Tzaar)
        const action = processed(game, state, placement)
        assert(isPlacePiece(action), 'The placement is processed')
        expect(action.metadata).toEqual({ stuckPlayerId: W })
        const next = execute(game, state, placement)
        expect(next.machineState).toBe(MachineState.EndOfGame)
        expect(next.winningPlayerIds).toEqual([B])
    })
})

describe('setup options', () => {
    const whiteOf = (state: TzaarGameState) =>
        state.players.find((player) => player.color === Color.White)?.playerId

    // The rulebook leaves the choice to the players; Random leaves it to the seeded draw.
    it('draws White by lot when Random, and when the creator does not play', () => {
        const outsider = { ownerId: 'u-host', userIds: { [W]: 'u-white', [B]: 'u-black' } }
        for (const [config, owner] of [
            [{ whitePlayer: WhitePlayer.Random }, undefined],
            [{ whitePlayer: WhitePlayer.Creator }, outsider],
            [{ whitePlayer: WhitePlayer.Opponent }, outsider]
        ] as const) {
            const whites = new Set(
                [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
                    const state = startUnassigned(createGame(config, owner), masterSeed(seed))
                    expect(state.activePlayerIds).toEqual([whiteOf(state)])
                    return whiteOf(state)
                })
            )
            expect(whites).toEqual(new Set([W, B]))
        }
    })

    it('counts the first seat as the creator in a local game', () => {
        const local = { ownerId: 'u-local', userIds: { [W]: 'u-local', [B]: 'u-local' } }
        for (const seed of [1, 2, 3, 4]) {
            const creator = startUnassigned(
                createGame({ whitePlayer: WhitePlayer.Creator }, local),
                masterSeed(seed)
            )
            expect(whiteOf(creator)).toBe(W)
            const opponent = startUnassigned(
                createGame({ whitePlayer: WhitePlayer.Opponent }, local),
                masterSeed(seed)
            )
            expect(whiteOf(opponent)).toBe(B)
        }
    })

    it('reads a missing option as its default and rejects an unknown one', () => {
        expect(versionFromConfig({})).toBe(TzaarVersion.Random)
        expect(whitePlayerFromConfig({})).toBe(WhitePlayer.Random)
        expect(() => versionFromConfig({ version: 'Bogus' })).toThrow()
        expect(() => whitePlayerFromConfig({ whitePlayer: 'Bogus' })).toThrow()
    })

    it('spreads the same random start from the same master seed', () => {
        const game = createGame({ version: TzaarVersion.Random })
        expect(start(game).board).toEqual(start(game).board)
        expect(start(game, masterSeed(1)).board).not.toEqual(start(game).board)
    })
})

describe('random playouts', () => {
    it.each(
        Object.values(TzaarVersion).flatMap((version) =>
            Array.from({ length: 12 }, (_, seed) => [version, seed] as const)
        )
    )('%s seed %i plays to a result', (version, seed) => {
        const game = createGame({ version })
        const state = playToEnd(game, start(game, masterSeed(seed + 1)), seed)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toHaveLength(1)
        const hydrated = new HydratedTzaarGameState(state)
        const loserId = hydrated.opponentOf(state.winningPlayerIds[0])
        expect(hydrated.missingKind(loserId) !== undefined || !hydrated.canCapture(loserId)).toBe(
            true
        )
        expect(state.board.stacks.every((stack) => stack.pieces.length > 0)).toBe(true)
        // Nothing reads past turns, so the series keeps only each player's latest.
        expect(state.turnManager.series.length).toBeLessThanOrEqual(2)
    })
})

describe('submitted coordinates', () => {
    // The key a space is stored under folds fractions onto other spaces: {0.5, 1} reads the
    // stack on {-1, 1}, and {1.5, 0} the one on {-2, 0}, which is not in line with it.
    it('rejects a capture between fractional coordinates that alias real spaces', () => {
        const game = createGame()
        const from = spaceName({ q: -1, r: 1 })
        const to = spaceName({ q: -2, r: 0 })
        const state = position(game, { ...BLACK_KIT, A1: 'A', A2: 'T', [from]: 'R', [to]: 'a' })
        const real = new HydratedTzaarGameState(state)
        expect(real.captures(W).some((move) => spaceName(move.from) === from)).toBe(false)
        const forged = {
            ...base(game, W),
            type: ActionType.Capture,
            from: { q: 0.5, r: 1 },
            to: { q: 1.5, r: 0 }
        }
        expect(() => execute(game, state, forged)).toThrow()
    })

    it('places no piece between spaces in a tournament', () => {
        const game = createGame({ version: TzaarVersion.Tournament })
        const state = start(game)
        const place = placeAction(game, W, 'E4', PieceKind.Tott)
        for (const coords of [
            { q: 0, r: -1.5 },
            { q: 0.25, r: 1 }
        ]) {
            const forged: PlacePiece = { ...place, coords }
            expect(() => execute(game, state, forged)).toThrow()
        }
    })
})

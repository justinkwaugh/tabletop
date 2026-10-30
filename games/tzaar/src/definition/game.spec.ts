import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    Color,
    defaultGameConfig,
    GameEngine,
    GameResult,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from './definition.js'
import { TzaarRuntime } from './runtime.js'
import { TzaarInfo } from './info.js'
import { TzaarVersion, WhitePlayer } from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { HydratedTzaarGameState, type TzaarGameState } from '../model/gameState.js'
import { SPACES } from '../model/geometry.js'
import { spaceFromName, spaceName } from '../model/notation.js'
import { PIECE_KINDS, PIECES_OF_KIND, PieceKind, type Piece } from '../model/board.js'
import { FIXED_START } from '../model/startPositions.js'
import { isCapture, type Capture } from '../actions/capture.js'
import type { Stack } from '../actions/stack.js'
import { isPass, type Pass } from '../actions/pass.js'
import type { PlacePiece } from '../actions/placePiece.js'

const engine = new GameEngine(TzaarRuntime)
const W = 'white'
const B = 'black'

function createGame(
    config: { version?: TzaarVersion; whitePlayer?: WhitePlayer } = {},
    owner: { ownerId: string; userIds: Record<string, string> } = {
        ownerId: 'owner',
        userIds: {}
    }
) {
    return TzaarRuntime.initializer.initializeGame(
        {
            id: 'tzaar-test',
            typeId: 'tzaar',
            ownerId: owner.ownerId,
            seed: 5,
            config: { ...defaultGameConfig(TzaarInfo.configurator?.options ?? []), ...config },
            players: [W, B].map((id) => ({
                id,
                name: id,
                userId: owner.userIds[id],
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

type TzaarGame = ReturnType<typeof createGame>

function start(game: TzaarGame): TzaarGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [W, B] } }).initialState
}

function startUnassigned(game: TzaarGame): TzaarGameState {
    return engine.startGame(game).initialState
}

let counter = 0
function base(game: TzaarGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

function execute(game: TzaarGame, state: TzaarGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

function processed(game: TzaarGame, state: TzaarGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).processedActions[0]
}

function captureMetadata(game: TzaarGame, state: TzaarGameState, from: string, to: string) {
    const action = processed(game, state, captureAction(game, W, from, to))
    expect(isCapture(action)).toBe(true)
    return isCapture(action) ? action.metadata : undefined
}

function passMetadata(game: TzaarGame, state: TzaarGameState) {
    const action = processed(game, state, passAction(game, W))
    expect(isPass(action)).toBe(true)
    return isPass(action) ? action.metadata : undefined
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

// Stacks read bottom to top: R Tzaar, A Tzarra, T Tott; capitals are White's, lower case
// Black's. Every other space is empty and White makes the first capture of a turn.
function position(game: TzaarGame, stacks: Record<string, string>): TzaarGameState {
    const state = start(createGame({ version: TzaarVersion.Fixed }))
    let id = 0
    for (const space of state.board.spaces) {
        space.stack = (stacks[spaceName(space.coords)] ?? '').split('').map((letter): Piece => ({
            id: id++,
            playerId: letter === letter.toUpperCase() ? W : B,
            kind: KIND_LETTERS[letter.toLowerCase()]
        }))
    }
    return { ...state, gameId: game.id }
}

function stackAt(state: TzaarGameState, name: string): string {
    const stack = state.board.spaces.find((space) => spaceName(space.coords) === name)?.stack ?? []
    return stack
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
            const ids = state.board.spaces.map((space) => space.stack[0].id)
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
        expect(state.board.spaces.every((space) => space.stack.length === 0)).toBe(true)
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
        expect(next.activePlayerIds).toEqual([B])
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
})

function legalActions(game: TzaarGame, state: TzaarGameState): GameAction[] {
    const hydrated = new HydratedTzaarGameState(state)
    const [playerId] = state.activePlayerIds
    const named = (move: { from: { q: number; r: number }; to: { q: number; r: number } }) =>
        [spaceName(move.from), spaceName(move.to)] as const
    if (state.machineState === MachineState.PlacingPieces) {
        return hydrated.board
            .vacantSpaces()
            .flatMap((coords) =>
                hydrated
                    .kindsInHand(playerId)
                    .map((kind) => placeAction(game, playerId, spaceName(coords), kind))
            )
    }
    const captures = hydrated
        .captures(playerId)
        .map((move) => captureAction(game, playerId, ...named(move)))
    if (state.machineState === MachineState.Capturing) {
        return captures
    }
    return [
        ...captures,
        ...hydrated.stackings(playerId).map((move) => stackAction(game, playerId, ...named(move))),
        passAction(game, playerId)
    ]
}

describe('random playouts', () => {
    it.each(
        Object.values(TzaarVersion).flatMap((version) =>
            Array.from({ length: 12 }, (_, seed) => [version, seed] as const)
        )
    )('%s seed %i plays to a result', (version, seed) => {
        const game = { ...createGame({ version }), seed: seed + 1 }
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
            expect(steps).toBeLessThan(400)
        }
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toHaveLength(1)
        const hydrated = new HydratedTzaarGameState(state)
        const loserId = hydrated.opponentOf(state.winningPlayerIds[0])
        expect(hydrated.missingKind(loserId) !== undefined || !hydrated.canCapture(loserId)).toBe(
            true
        )
    })
})

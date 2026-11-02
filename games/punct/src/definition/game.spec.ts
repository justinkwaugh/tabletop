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
import { PunctRuntime } from './runtime.js'
import { PunctInfo } from './info.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import {
    EndReason,
    HydratedPunctGameState,
    Variant,
    type PunctGameState
} from '../model/gameState.js'
import { HydratedPunctBoard, type PlacedPiece } from '../model/board.js'
import { CENTRE_SPACES, SPACES, spaceAt, spaceName } from '../model/geometry.js'
import { dotsOf, PieceKind, SET_SIZE } from '../model/pieces.js'
import type { Reserve } from '../model/playerState.js'
import type { PlacePiece } from '../actions/placePiece.js'
import { isMovePiece, type MovePiece } from '../actions/movePiece.js'

const engine = new GameEngine(PunctRuntime)
const W = 'white'
const B = 'black'

function createGame(variant: Variant = Variant.Standard) {
    return PunctRuntime.initializer.initializeGame(
        {
            id: 'punct-test',
            typeId: 'punct',
            ownerId: 'owner',
            seed: 5,
            config: { ...defaultGameConfig(PunctInfo.configurator?.options ?? []), variant },
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

type PunctGame = ReturnType<typeof createGame>

function start(game: PunctGame): PunctGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [W, B] } }).initialState
}

let counter = 0
function base(game: PunctGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

function execute(game: PunctGame, state: PunctGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

function placeAction(
    game: PunctGame,
    playerId: string,
    kind: PieceKind,
    punct: string,
    rotation: number
): PlacePiece {
    return {
        ...base(game, playerId),
        type: ActionType.PlacePiece,
        kind,
        punct: spaceAt(punct),
        rotation
    }
}

function moveAction(
    game: PunctGame,
    playerId: string,
    from: string,
    to: string,
    rotation: number
): MovePiece {
    return {
        ...base(game, playerId),
        type: ActionType.MovePiece,
        from: spaceAt(from),
        to: spaceAt(to),
        rotation
    }
}

type PieceSpec = [player: string, kind: PieceKind, punct: string, rotation: number, level: number]

// Rewrites a started state with these pieces in play, each player's reserve reduced to match
// unless given. White is to move.
function position(
    state: PunctGameState,
    pieces: PieceSpec[],
    reserves: Partial<Record<string, Reserve>> = {}
): PunctGameState {
    const placed = positionPieces(pieces)
    const players = state.players.map((player) => {
        const reserve = { ...(reserves[player.playerId] ?? player.reserve) }
        if (reserves[player.playerId] === undefined) {
            for (const piece of placed.filter((p) => p.playerId === player.playerId)) {
                reserve[piece.kind] = Math.max(0, reserve[piece.kind] - 1)
            }
        }
        return { ...player, reserve }
    })
    return { ...state, players, board: { pieces: placed }, nextPieceId: placed.length }
}

function hydrated(state: PunctGameState) {
    return new HydratedPunctGameState(state)
}

function names(coords: { q: number; r: number }[]): string[] {
    return coords.map(spaceName).sort()
}

describe('PÜNCT geometry', () => {
    it('has 211 spaces in columns of BoardSpace’s lengths and a 19-space centre', () => {
        expect(SPACES).toHaveLength(211)
        expect(CENTRE_SPACES).toHaveLength(19)
        const lengths = [...'ABCDEFGHIJKLMNOPQ'].map(
            (column) => SPACES.filter((coords) => spaceName(coords)[0] === column).length
        )
        expect(lengths).toEqual([7, 10, 11, 12, 13, 14, 15, 16, 15, 16, 15, 14, 13, 12, 11, 10, 7])
    })

    it('names spaces as BoardSpace does', () => {
        const column = (letter: string) =>
            SPACES.filter((coords) => spaceName(coords)[0] === letter)
                .map((coords) => Number(spaceName(coords).slice(1)))
                .sort((a, b) => a - b)
        expect(column('A')).toEqual([2, 3, 4, 5, 6, 7, 8])
        expect(column('H')[0]).toBe(1)
        expect(column('I')).toEqual(Array.from({ length: 15 }, (_, index) => index + 2))
        expect(column('Q')).toEqual([10, 11, 12, 13, 14, 15, 16])
        expect(spaceName({ q: 0, r: 0 })).toBe('I9')
    })

    it('shapes each kind of piece round its PÜNCT', () => {
        const e5 = spaceAt('E5')
        expect(dotsOf(PieceKind.Triangle, e5, 0).map(spaceName)).toEqual(['E5', 'E6', 'F6'])
        expect(dotsOf(PieceKind.StraightEnd, e5, 2).map(spaceName)).toEqual(['E5', 'F5', 'G5'])
        expect(dotsOf(PieceKind.StraightCentre, e5, 0).map(spaceName)).toEqual(['E5', 'E6', 'E4'])
        expect(dotsOf(PieceKind.AngleCorner, e5, 0).map(spaceName)).toEqual(['E5', 'E6', 'F5'])
        expect(dotsOf(PieceKind.AngleLeft, e5, 0).map(spaceName)).toEqual(['E5', 'E6', 'D6'])
        expect(dotsOf(PieceKind.AngleRight, e5, 0).map(spaceName)).toEqual(['E5', 'E6', 'F7'])
        expect(SET_SIZE).toBe(18)
    })
})

describe('PÜNCT adding a piece', () => {
    it('keeps every new piece out of the central hexagon in the standard game', () => {
        const game = createGame(Variant.Standard)
        let state = start(game)
        expect(() =>
            execute(game, state, placeAction(game, W, PieceKind.Triangle, 'G7', 0))
        ).toThrow()
        state = execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 0))
        expect(() =>
            execute(game, state, placeAction(game, B, PieceKind.StraightEnd, 'I9', 0))
        ).toThrow()
        expect(() =>
            execute(game, state, placeAction(game, B, PieceKind.StraightEnd, 'I12', 3))
        ).toThrow()
    })

    it('keeps only White’s first piece out of the centre in the basic game', () => {
        const game = createGame(Variant.Basic)
        let state = start(game)
        expect(() =>
            execute(game, state, placeAction(game, W, PieceKind.Triangle, 'I9', 0))
        ).toThrow()
        state = execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 0))
        state = execute(game, state, placeAction(game, B, PieceKind.Triangle, 'I9', 0))
        state = execute(game, state, placeAction(game, W, PieceKind.StraightEnd, 'I7', 3))
        expect(hydrated(state).board.pieces).toHaveLength(3)
    })

    it('puts a new piece only on empty spaces of the board', () => {
        const game = createGame()
        const state = position(start(game), [[B, PieceKind.Triangle, 'C5', 0, 0]])
        expect(() =>
            execute(game, state, placeAction(game, W, PieceKind.StraightEnd, 'C4', 0))
        ).toThrow()
        expect(() =>
            execute(game, state, placeAction(game, W, PieceKind.StraightEnd, 'A8', 0))
        ).toThrow()
    })
})

describe('PÜNCT moving a piece', () => {
    it('moves the PÜNCT along a straight line, turning the piece if wanted', () => {
        const game = createGame()
        const state = position(start(game), [[W, PieceKind.StraightEnd, 'C4', 0, 0]])
        const moved = execute(game, state, moveAction(game, W, 'C4', 'C9', 3))
        const piece = hydrated(moved).board.pieces[0]
        expect(spaceName(piece.punct)).toBe('C9')
        expect(piece.rotation).toBe(3)
        expect(() => execute(game, state, moveAction(game, W, 'C4', 'D6', 0))).toThrow()
    })

    it('counts turning in place as a move, but not putting it back as it was', () => {
        const game = createGame()
        const state = position(start(game), [[W, PieceKind.Triangle, 'C4', 0, 0]])
        const turned = execute(game, state, moveAction(game, W, 'C4', 'C4', 2))
        expect(hydrated(turned).board.pieces[0].rotation).toBe(2)
        expect(() => execute(game, state, moveAction(game, W, 'C4', 'C4', 0))).toThrow()
    })

    it('treats a straight piece turned half round its central PÜNCT as unmoved', () => {
        const board = new HydratedPunctBoard({
            pieces: [
                {
                    id: 0,
                    playerId: W,
                    kind: PieceKind.StraightCentre,
                    punct: spaceAt('C5'),
                    rotation: 0,
                    level: 0
                }
            ]
        })
        const inPlace = board
            .movesOf(board.pieces[0])
            .filter((move) => spaceName(move.punct) === 'C5')
        expect(inPlace.map((move) => move.rotation)).toEqual([1, 2])
    })

    it('keeps the way round a centre-PÜNCT straight piece was put, half turns the same placement', () => {
        const game = createGame()
        const state = position(start(game), [[W, PieceKind.StraightCentre, 'C5', 0, 0]])
        const turned = execute(game, state, moveAction(game, W, 'C5', 'C9', 4))
        expect(hydrated(turned).board.pieces[0].rotation).toBe(4)
        expect(() => execute(game, state, moveAction(game, W, 'C5', 'C5', 3))).toThrow()
        const placed = execute(game, state, placeAction(game, W, PieceKind.StraightCentre, 'F4', 5))
        expect(hydrated(placed).board.pieces[1].rotation).toBe(5)
    })

    it('keeps minor dots on the board at its edge', () => {
        const game = createGame()
        const state = position(start(game), [[W, PieceKind.StraightEnd, 'C4', 0, 0]])
        expect(() => execute(game, state, moveAction(game, W, 'C4', 'C11', 0))).toThrow()
        execute(game, state, moveAction(game, W, 'C4', 'C11', 3))
    })
})

describe('PÜNCT jumping on top', () => {
    const pile: PieceSpec[] = [
        [W, PieceKind.StraightEnd, 'D3', 0, 0],
        [B, PieceKind.StraightEnd, 'E3', 0, 0],
        [W, PieceKind.StraightEnd, 'F2', 0, 0]
    ]

    it('lands its PÜNCT on the player’s own piece, its minor dots on anything at that level', () => {
        const game = createGame()
        const state = position(start(game), [...pile, [W, PieceKind.Triangle, 'D8', 3, 0]])
        const moved = execute(game, state, moveAction(game, W, 'D8', 'D4', 2))
        const piece = hydrated(moved).board.pieces[3]
        expect(piece.level).toBe(1)
        expect(names(hydrated(moved).board.dotsOf(piece))).toEqual(['D3', 'D4', 'E4'])
    })

    it('never lands its PÜNCT on the opponent’s piece', () => {
        const game = createGame()
        const state = position(start(game), [...pile, [W, PieceKind.Triangle, 'E8', 3, 0]])
        expect(() => execute(game, state, moveAction(game, W, 'E8', 'E4', 5))).toThrow()
    })

    it('needs every dot at one level unless it bridges', () => {
        const game = createGame()
        const state = position(start(game), [...pile, [W, PieceKind.Triangle, 'D8', 3, 0]])
        expect(() => execute(game, state, moveAction(game, W, 'D8', 'D4', 3))).toThrow()
    })

    it('freezes a piece with any dot covered', () => {
        const game = createGame()
        const state = position(start(game), [...pile, [B, PieceKind.Triangle, 'D4', 2, 1]])
        expect(() => execute(game, state, moveAction(game, W, 'D3', 'D9', 0))).toThrow()
        const covered = hydrated(state).board.pieces[0]
        expect(hydrated(state).board.isCovered(covered)).toBe(true)
        expect(hydrated(state).board.movesOf(covered)).toEqual([])
    })

    it('can go back down to the board from any level', () => {
        const game = createGame()
        const state = position(start(game), [...pile, [W, PieceKind.Triangle, 'D4', 2, 1]])
        const moved = execute(game, state, moveAction(game, W, 'D4', 'D9', 2))
        expect(hydrated(moved).board.pieces[3].level).toBe(0)
    })
})

describe('PÜNCT bridges', () => {
    // Two white piles one space apart, with C5 empty between them.
    const piers: PieceSpec[] = [
        [W, PieceKind.StraightCentre, 'C3', 0, 0],
        [W, PieceKind.StraightCentre, 'C7', 0, 0]
    ]

    it('lets a straight piece span a gap with its middle dot over nothing', () => {
        const game = createGame()
        const state = position(start(game), [...piers, [W, PieceKind.StraightEnd, 'H4', 0, 0]])
        const moved = execute(game, state, moveAction(game, W, 'H4', 'C4', 0))
        const board = hydrated(moved).board
        expect(board.pieces[2].level).toBe(1)
        expect(board.heightAt(spaceAt('C5'))).toBe(2)
    })

    it('blocks the space under a bridge, even for a new piece', () => {
        const game = createGame()
        const state = position(start(game), [
            ...piers,
            [W, PieceKind.StraightEnd, 'C4', 0, 1],
            [W, PieceKind.Triangle, 'L4', 0, 0]
        ])
        expect(() =>
            execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 4))
        ).toThrow()
    })

    it('never lets a triangle bridge', () => {
        const board = new HydratedPunctBoard({ pieces: [] })
        expect(board.levelFor(W, PieceKind.Triangle, spaceAt('C4'), 0)).toBe(0)
        const piers2 = new HydratedPunctBoard({
            pieces: [
                {
                    id: 0,
                    playerId: W,
                    kind: PieceKind.StraightEnd,
                    punct: spaceAt('C2'),
                    rotation: 0,
                    level: 0
                },
                {
                    id: 1,
                    playerId: W,
                    kind: PieceKind.Triangle,
                    punct: spaceAt('D5'),
                    rotation: 0,
                    level: 0
                }
            ]
        })
        // C4 and D5 at height 1 with D4 empty below the third dot.
        expect(piers2.levelFor(W, PieceKind.Triangle, spaceAt('C4'), 2)).toBeUndefined()
    })

    it('lets a central PÜNCT bridge only over the player’s own piece', () => {
        const ownBelow: PieceSpec = [W, PieceKind.Triangle, 'B5', 2, 0]
        const theirsBelow: PieceSpec = [B, PieceKind.Triangle, 'B5', 2, 0]
        const tower: PieceSpec[] = [
            [W, PieceKind.StraightEnd, 'C2', 0, 0],
            [W, PieceKind.StraightEnd, 'C2', 0, 1],
            [W, PieceKind.StraightEnd, 'C8', 3, 0],
            [W, PieceKind.StraightEnd, 'C8', 3, 1]
        ]
        // C4 and C6 stand two high; C5 holds a single piece's dot.
        const withOwn = new HydratedPunctBoard({ pieces: positionPieces([...tower, ownBelow]) })
        expect(withOwn.levelFor(W, PieceKind.StraightCentre, spaceAt('C5'), 0)).toBe(2)
        const withTheirs = new HydratedPunctBoard({
            pieces: positionPieces([...tower, theirsBelow])
        })
        expect(withTheirs.levelFor(W, PieceKind.StraightCentre, spaceAt('C5'), 0)).toBeUndefined()
        const overNothing = new HydratedPunctBoard({ pieces: positionPieces(tower) })
        expect(overNothing.levelFor(W, PieceKind.StraightCentre, spaceAt('C5'), 0)).toBeUndefined()
    })
})

function positionPieces(pieces: PieceSpec[]): PlacedPiece[] {
    return pieces.map(([playerId, kind, punct, rotation, level], id) => ({
        id,
        playerId,
        kind,
        punct: spaceAt(punct),
        rotation,
        level
    }))
}

// Zigzags across from column A to column Q, three spaces to each angular piece and a straight
// piece to finish: Black's along A5–Q13, White's two lines higher along A7–Q15.
function zigzag(playerId: string, centres: string[], last: string): PieceSpec[] {
    return [
        ...centres.map((centre, index): PieceSpec => [
            playerId,
            PieceKind.AngleCorner,
            centre,
            index % 2 === 0 ? 5 : 2,
            0
        ]),
        [playerId, PieceKind.StraightEnd, last, 4, 0]
    ]
}

const blackRow = zigzag(B, ['B5', 'E7', 'H8', 'K10', 'N11'], 'Q13')
// White's lacks D8, E9 and F9, an angular piece's place.
const whiteRowWithGap = zigzag(W, ['B7', 'E9', 'H10', 'K12', 'N13'], 'Q15').filter(
    ([, , punct]) => punct !== 'E9'
)
// White's angular piece over I9, H9 and J10, covering Black's I9.
const whiteCover: PieceSpec = [W, PieceKind.AngleCorner, 'I9', 5, 1]

describe('PÜNCT connections', () => {
    it('wins by joining two opposite sides with visible dots', () => {
        const game = createGame()
        const almost = zigzag(W, ['B5', 'E7', 'H8', 'K10', 'N11'], 'Q13').slice(0, -1)
        const state = position(start(game), [...almost, [B, PieceKind.Triangle, 'C2', 0, 0]])
        const won = execute(game, state, placeAction(game, W, PieceKind.StraightEnd, 'Q13', 4))
        expect(hydrated(won).board.connection(W)).toHaveLength(18)
        expect(won.machineState).toBe(MachineState.EndOfGame)
        expect(won.result).toBe(GameResult.Win)
        expect(won.winningPlayerIds).toEqual([W])
        expect(won.endReason).toBe(EndReason.Connection)
    })

    it('needs the dots seen from above: a covered dot breaks the chain', () => {
        const board = new HydratedPunctBoard({ pieces: positionPieces([...blackRow, whiteCover]) })
        expect(board.connection(B)).toBeUndefined()
    })

    it('gives the opponent the win when a move completes only their connection', () => {
        const game = createGame()
        const state = position(start(game), [...blackRow, ...whiteRowWithGap, whiteCover])
        const after = execute(game, state, moveAction(game, W, 'I9', 'I4', 5))
        expect(after.winningPlayerIds).toEqual([B])
        expect(after.endReason).toBe(EndReason.Connection)
    })

    it('gives the mover the win when a move completes both connections', () => {
        const game = createGame()
        const state = position(start(game), [...blackRow, ...whiteRowWithGap, whiteCover])
        expect(hydrated(state).board.connection(B)).toBeUndefined()
        expect(hydrated(state).board.connection(W)).toBeUndefined()
        const after = execute(game, state, moveAction(game, W, 'I9', 'E9', 2))
        expect(hydrated(after).board.connection(B)).toBeDefined()
        expect(hydrated(after).board.connection(W)).toBeDefined()
        expect(after.winningPlayerIds).toEqual([W])
    })
})

describe('PÜNCT last piece', () => {
    const lastTriangle = { [W]: { ...emptyReserve(), [PieceKind.Triangle]: 1 } }

    it('ends the standard game on the most central spaces', () => {
        const game = createGame(Variant.Standard)
        const state = position(
            start(game),
            [
                [W, PieceKind.Triangle, 'I9', 0, 0],
                [B, PieceKind.StraightEnd, 'H6', 0, 0]
            ],
            lastTriangle
        )
        const after = execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 0))
        expect(after.machineState).toBe(MachineState.EndOfGame)
        expect(after.result).toBe(GameResult.Win)
        expect(after.winningPlayerIds).toEqual([W])
        expect(after.endReason).toBe(EndReason.CentreCount)
    })

    it('draws the standard game on equal central spaces', () => {
        const game = createGame(Variant.Standard)
        const state = position(start(game), [], lastTriangle)
        const after = execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 0))
        expect(after.result).toBe(GameResult.Draw)
        expect(after.winningPlayerIds.sort()).toEqual([B, W])
    })

    it('ends the basic game undecided', () => {
        const game = createGame(Variant.Basic)
        const state = position(start(game), [[W, PieceKind.Triangle, 'I9', 0, 0]], lastTriangle)
        const after = execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 0))
        expect(after.result).toBe(GameResult.Draw)
        expect(after.endReason).toBe(EndReason.LastPiece)
    })
})

describe('PÜNCT passing', () => {
    it('passes a player with no legal action, recording it on the move before', () => {
        const game = createGame()
        // Black has nothing in reserve and its only piece is covered.
        const state = position(
            start(game),
            [
                [B, PieceKind.Triangle, 'C4', 0, 0],
                [W, PieceKind.Triangle, 'C4', 0, 1],
                [W, PieceKind.Triangle, 'L4', 0, 0]
            ],
            { [B]: emptyReserve() }
        )
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: moveAction(game, W, 'L4', 'L4', 5)
        })
        const processed = result.processedActions[0]
        expect(isMovePiece(processed) && processed.metadata?.passedPlayerId).toBe(B)
        expect(result.updatedState.activePlayerIds).toEqual([W])
    })
})

function emptyReserve(): Reserve {
    return {
        [PieceKind.Triangle]: 0,
        [PieceKind.StraightEnd]: 0,
        [PieceKind.StraightCentre]: 0,
        [PieceKind.AngleCorner]: 0,
        [PieceKind.AngleLeft]: 0,
        [PieceKind.AngleRight]: 0
    }
}

describe('PÜNCT random playouts', () => {
    function legalActions(game: PunctGame, state: PunctGameState): GameAction[] {
        const hydratedState = hydrated(state)
        const playerId = state.activePlayerIds[0]
        const player = hydratedState.getPlayerState(playerId)
        const placements = player.kindsInReserve().flatMap((kind) =>
            hydratedState.entriesOf(playerId, kind).map((entry) => ({
                ...base(game, playerId),
                type: ActionType.PlacePiece,
                kind,
                punct: entry.punct,
                rotation: entry.rotation
            }))
        )
        const moves = hydratedState.board.movablePieces(playerId).flatMap((piece) =>
            hydratedState.board.movesOf(piece).map((move) => ({
                ...base(game, playerId),
                type: ActionType.MovePiece,
                from: piece.punct,
                to: move.punct,
                rotation: move.rotation
            }))
        )
        return [...placements, ...moves]
    }

    for (const variant of [Variant.Standard, Variant.Basic]) {
        it(`ends every ${variant} game with a result`, { timeout: 120_000 }, () => {
            for (let seed = 1; seed <= 6; seed++) {
                let random = seed * 7919
                const next = () => {
                    random = (random * 16807) % 2147483647
                    return random / 2147483647
                }
                const game = createGame(variant)
                let state = start(game)
                let steps = 0
                while (state.machineState !== MachineState.EndOfGame && steps < 400) {
                    const actions = legalActions(game, state)
                    expect(actions.length).toBeGreaterThan(0)
                    const wantMove = next() < 0.6
                    const pool = actions.filter(
                        (action) =>
                            (action.type === ActionType.MovePiece) === wantMove ||
                            !actions.some(
                                (other) => (other.type === ActionType.MovePiece) === wantMove
                            )
                    )
                    state = execute(game, state, pool[Math.floor(next() * pool.length)])
                    steps += 1
                }
                expect(state.machineState).toBe(MachineState.EndOfGame)
                expect(state.result).toBeDefined()
                expect(state.winningPlayerIds.length).toBeGreaterThan(0)
            }
        })
    }
})

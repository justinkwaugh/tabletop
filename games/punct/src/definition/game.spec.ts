import { describe, expect, it } from 'vitest'
import { Color, coordinatesToNumber, GameResult } from '@tabletop/common'
import { PunctRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { Variant, variantFromConfig, WhitePlayer, whitePlayerFromConfig } from './config.js'
import { EndReason, HydratedPunctGameState, type PunctGameState } from '../model/gameState.js'
import { HydratedPunctBoard, type PlacedPiece } from '../model/board.js'
import { CENTRE_SPACES, SPACES, spaceAt, spaceName } from '../model/geometry.js'
import {
    dotsOf,
    PIECE_KINDS,
    PieceKind,
    rotationsOf,
    SET_COUNTS,
    SET_SIZE
} from '../model/pieces.js'
import type { PlacePiece } from '../actions/placePiece.js'
import { isMovePiece, type MovePiece } from '../actions/movePiece.js'
import {
    actionBase as base,
    createGame as createTestGame,
    engine,
    execute,
    MASTER_SEED,
    playToEnd,
    type Owner,
    type PunctConfig,
    type PunctGame
} from './tests/playthrough.js'

const W = 'white'
const B = 'black'

function createGame(variant: Variant = Variant.Standard, owner?: Owner) {
    return createConfiguredGame({ variant }, owner)
}

function createConfiguredGame(config: PunctConfig, owner?: Owner) {
    return createTestGame(config, [W, B], owner)
}

// A distinct fixed master seed for each number.
function masterSeed(number: number): string {
    return number.toString(16).padStart(32, '0')
}

function start(game: PunctGame): PunctGameState {
    return engine.startGame(game, {
        masterSeed: MASTER_SEED,
        startingPositions: { playerIds: [W, B] }
    }).initialState
}

function startUnassigned(game: PunctGame, seed: string = MASTER_SEED): PunctGameState {
    return engine.startGame(game, { masterSeed: seed }).initialState
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

// Rewrites a started state with these pieces in play, ids in the order given. White is to move.
function position(state: PunctGameState, pieces: PieceSpec[]): PunctGameState {
    return { ...state, board: { pieces: positionPieces(pieces) } }
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

    it('refuses a moved piece under a bridge, at any level', () => {
        const game = createGame()
        const mover: PieceSpec = [W, PieceKind.Triangle, 'C10', 0, 0]
        const bridged = position(start(game), [
            ...piers,
            [W, PieceKind.StraightEnd, 'C4', 0, 1],
            mover
        ])
        expect(() => execute(game, bridged, moveAction(game, W, 'C10', 'C5', 4))).toThrow()
        const board = hydrated(bridged).board
        const piece = board.pieces[3]
        const underBridge = board
            .movesOf(piece)
            .filter((move) =>
                dotsOf(piece.kind, move.punct, move.rotation).some((dot) => spaceName(dot) === 'C5')
            )
        expect(underBridge.every((move) => move.level >= 2)).toBe(true)
        // Without the bridge the same move lands on the board.
        const open = position(start(game), [...piers, mover])
        const moved = execute(game, open, moveAction(game, W, 'C10', 'C5', 4))
        expect(hydrated(moved).board.pieces[2].level).toBe(0)
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

// Brings the rest of a player's set into play, all but the kinds kept back, packed into rows 1–4
// and stacked on their own pieces once those fill. The rows lie outside the centre and touch only
// one side of the board, so the pieces never connect.
function restInPlay(playerId: string, keep: PieceKind[], pieces: PieceSpec[]): PieceSpec[] {
    const rows = new Set(SPACES.map(spaceName).filter((name) => Number(name.slice(1)) <= 4))
    const placed = [...pieces]
    for (const kind of PIECE_KINDS) {
        const held =
            placed.filter(([owner, heldKind]) => owner === playerId && heldKind === kind).length +
            keep.filter((kept) => kept === kind).length
        for (let count = held; count < SET_COUNTS[kind]; count++) {
            const board = new HydratedPunctBoard({ pieces: positionPieces(placed) })
            const spot = SPACES.filter((punct) => rows.has(spaceName(punct)))
                .flatMap((punct) => rotationsOf(kind).map((rotation) => ({ punct, rotation })))
                .map(({ punct, rotation }) => ({
                    punct,
                    rotation,
                    level: dotsOf(kind, punct, rotation).every((dot) => rows.has(spaceName(dot)))
                        ? board.levelFor(playerId, kind, punct, rotation)
                        : undefined
                }))
                .find(({ level }) => level !== undefined)
            if (spot?.level === undefined) throw Error(`No room for ${playerId}'s ${kind}`)
            placed.push([playerId, kind, spaceName(spot.punct), spot.rotation, spot.level])
        }
    }
    return placed
}

describe('PÜNCT last piece', () => {
    it('ends the standard game on the most central spaces', () => {
        const game = createGame(Variant.Standard)
        const pieces = restInPlay(
            W,
            [PieceKind.Triangle],
            [
                [W, PieceKind.Triangle, 'I9', 0, 0],
                [B, PieceKind.StraightEnd, 'H6', 0, 0]
            ]
        )
        const state = position(start(game), pieces)
        expect(hydrated(state).reserveSize(W)).toBe(1)
        const after = execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 0))
        expect(after.machineState).toBe(MachineState.EndOfGame)
        expect(after.result).toBe(GameResult.Win)
        expect(after.winningPlayerIds).toEqual([W])
        expect(after.endReason).toBe(EndReason.CentreCount)
        expect(PunctRuntime.scoring?.finalScores(after)).toEqual({ [W]: 1, [B]: 0 })
    })

    it('draws the standard game on equal central spaces', () => {
        const game = createGame(Variant.Standard)
        const state = position(start(game), restInPlay(W, [PieceKind.Triangle], []))
        const after = execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 0))
        expect(after.result).toBe(GameResult.Draw)
        expect(after.winningPlayerIds.sort()).toEqual([B, W])
        expect(PunctRuntime.scoring?.finalScores(after)).toEqual({ [W]: 1, [B]: 1 })
    })

    it('ends the basic game undecided', () => {
        const game = createGame(Variant.Basic)
        const state = position(
            start(game),
            restInPlay(W, [PieceKind.Triangle], [[W, PieceKind.Triangle, 'I9', 0, 0]])
        )
        const after = execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 0))
        expect(after.result).toBe(GameResult.Draw)
        expect(after.endReason).toBe(EndReason.LastPiece)
    })
})

describe('PÜNCT reserve', () => {
    it('counts each kind of the set not yet in play', () => {
        const game = createGame()
        let state = start(game)
        expect(hydrated(state).reserveSize(W)).toBe(SET_SIZE)
        state = execute(game, state, placeAction(game, W, PieceKind.StraightEnd, 'C4', 0))
        const after = hydrated(state)
        expect(after.reserveCount(W, PieceKind.StraightEnd)).toBe(
            SET_COUNTS[PieceKind.StraightEnd] - 1
        )
        expect(after.reserveCount(B, PieceKind.StraightEnd)).toBe(SET_COUNTS[PieceKind.StraightEnd])
        expect(after.reserveSize(W)).toBe(SET_SIZE - 1)
    })

    it('gives each new piece the next id in entry order', () => {
        const game = createGame()
        let state = start(game)
        state = execute(game, state, placeAction(game, W, PieceKind.Triangle, 'C5', 0))
        state = execute(game, state, placeAction(game, B, PieceKind.Triangle, 'L4', 0))
        state = execute(game, state, moveAction(game, W, 'C5', 'C9', 0))
        state = execute(game, state, placeAction(game, B, PieceKind.Triangle, 'N10', 0))
        expect(state.board.pieces.map((piece) => piece.id)).toEqual([0, 1, 2])
        expect(hydrated(state).board.nextPieceId()).toBe(3)
    })

    it('leaves a player with no set left with no placement', () => {
        const game = createGame()
        const state = hydrated(position(start(game), restInPlay(W, [], [])))
        expect(state.reserveSize(W)).toBe(0)
        expect(state.kindsInReserve(W)).toEqual([])
        expect(state.canPlace(W)).toBe(false)
        expect(state.entriesOf(W, PieceKind.Triangle)).toEqual([])
    })
})

// A player keeps a piece in reserve until the game ends, and two sets of 18 can hardly cover the
// board enough to leave it no entry. Neutral pieces fill every space not given, so that neither
// player can enter.
const WALL = 'wall'
function walled(pieces: PieceSpec[], holes: PieceSpec[] = []): PieceSpec[] {
    const open = new Set(
        positionPieces([...pieces, ...holes]).flatMap((piece) =>
            dotsOf(piece.kind, piece.punct, piece.rotation).map(spaceName)
        )
    )
    const names = new Set(SPACES.map(spaceName))
    const covered = new Set<string>()
    const wall: PieceSpec[] = []
    for (const name of SPACES.map(spaceName)) {
        if (open.has(name) || covered.has(name)) continue
        const footprints = PIECE_KINDS.flatMap((kind) =>
            rotationsOf(kind).map((rotation) => ({
                kind,
                rotation,
                dots: dotsOf(kind, spaceAt(name), rotation).map(spaceName)
            }))
        ).filter(({ dots }) => dots.every((dot) => names.has(dot) && !open.has(dot)))
        // Wall pieces overlap where nothing else fits.
        const footprint =
            footprints.find(({ dots }) => dots.every((dot) => !covered.has(dot))) ?? footprints[0]
        if (footprint === undefined) throw Error(`No wall piece fits at ${name}`)
        footprint.dots.forEach((dot) => covered.add(dot))
        wall.push([WALL, footprint.kind, name, footprint.rotation, 0])
    }
    return [...pieces, ...wall]
}

describe('PÜNCT passing', () => {
    it('passes a player with no legal action, recording it on the move before', () => {
        const game = createGame()
        // White's top triangle can turn on the one below it; Black can neither enter nor move.
        const state = position(
            start(game),
            walled([
                [W, PieceKind.Triangle, 'G6', 0, 0],
                [W, PieceKind.Triangle, 'G6', 0, 1]
            ])
        )
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: moveAction(game, W, 'G6', 'G6', 2)
        })
        const processed = result.processedActions[0]
        expect(isMovePiece(processed) && processed.metadata?.passedPlayerId).toBe(B)
        expect(result.updatedState.activePlayerIds).toEqual([W])
    })

    it('draws the game when neither player can act', () => {
        const game = createGame()
        // White's angular piece fills the last open spaces, where it can neither move nor turn.
        const hole: PieceSpec = [W, PieceKind.AngleCorner, 'B3', 0, 0]
        const state = position(start(game), walled([], [hole]))
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: placeAction(game, W, PieceKind.AngleCorner, 'B3', 0)
        })
        const after = result.updatedState
        expect(hydrated(after).reserveSize(W)).toBe(SET_SIZE - 1)
        expect(after.machineState).toBe(MachineState.EndOfGame)
        expect(after.result).toBe(GameResult.Draw)
        expect(after.endReason).toBe(EndReason.NoMoves)
        expect(after.winningPlayerIds.sort()).toEqual([B, W])
        expect(PunctRuntime.scoring?.finalScores(after)).toEqual({ [W]: 1, [B]: 1 })
    })
})

describe('PÜNCT setup options', () => {
    const whiteOf = (state: PunctGameState) =>
        state.players.find((player) => player.color === Color.White)?.playerId

    it('gives White to the game creator or the opponent when chosen', () => {
        const owner = { ownerId: 'u-black', userIds: { [W]: 'u-white', [B]: 'u-black' } }
        const creatorWhite = startUnassigned(
            createConfiguredGame({ whitePlayer: WhitePlayer.Creator }, owner)
        )
        expect(whiteOf(creatorWhite)).toBe(B)
        expect(creatorWhite.activePlayerIds).toEqual([B])
        const opponentWhite = startUnassigned(
            createConfiguredGame({ whitePlayer: WhitePlayer.Opponent }, owner)
        )
        expect(whiteOf(opponentWhite)).toBe(W)
        expect(opponentWhite.activePlayerIds).toEqual([W])
    })

    it('draws White by lot when Random, and when the creator does not play', () => {
        const outsider = { ownerId: 'u-host', userIds: { [W]: 'u-white', [B]: 'u-black' } }
        for (const [config, owner] of [
            [{ whitePlayer: WhitePlayer.Random }, undefined],
            [{ whitePlayer: WhitePlayer.Creator }, outsider],
            [{ whitePlayer: WhitePlayer.Opponent }, outsider]
        ] as const) {
            const whites = new Set(
                [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
                    const state = startUnassigned(
                        createConfiguredGame(config, owner),
                        masterSeed(seed)
                    )
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
                createConfiguredGame({ whitePlayer: WhitePlayer.Creator }, local),
                masterSeed(seed)
            )
            expect(whiteOf(creator)).toBe(W)
            const opponent = startUnassigned(
                createConfiguredGame({ whitePlayer: WhitePlayer.Opponent }, local),
                masterSeed(seed)
            )
            expect(whiteOf(opponent)).toBe(B)
        }
    })

    it('reads a missing option as its default and rejects an unknown one', () => {
        expect(variantFromConfig({})).toBe(Variant.Standard)
        expect(whitePlayerFromConfig({})).toBe(WhitePlayer.Random)
        expect(() => variantFromConfig({ variant: 'Bogus' })).toThrow()
        expect(() => whitePlayerFromConfig({ whitePlayer: 'Bogus' })).toThrow()
    })
})

describe('PÜNCT random playouts', () => {
    it.each(
        Object.values(Variant).flatMap((variant) =>
            Array.from({ length: 6 }, (_, seed) => [variant, seed] as const)
        )
    )('%s seed %i plays to a result', (variant, seed) => {
        const game = createGame(variant)
        const state = playToEnd(game, start(game), seed)
        expect(state.result).toBeDefined()
        expect(state.winningPlayerIds.length).toBeGreaterThan(0)
        // Nothing reads past turns, so the series keeps only each player's latest.
        expect(state.turnManager.series.length).toBeLessThanOrEqual(2)
    })
})

describe('submitted coordinates', () => {
    // A fractional coordinate that shares a space's key, so key lookups would read that space.
    function aliasOf(coords: { q: number; r: number }) {
        for (let q = -12; q <= 12; q += 0.5) {
            for (let r = -12; r <= 12; r += 0.5) {
                if (Number.isInteger(q) && Number.isInteger(r)) continue
                if (coordinatesToNumber({ q, r }) === coordinatesToNumber(coords)) return { q, r }
            }
        }
        throw Error('No alias')
    }

    it('enters no piece between spaces', () => {
        const game = createGame()
        const state = start(game)
        const place = placeAction(game, W, PieceKind.Triangle, 'C5', 0)
        for (const punct of [aliasOf(place.punct), { q: place.punct.q + 0.25, r: place.punct.r }]) {
            const forged: PlacePiece = { ...place, punct }
            expect(() => execute(game, state, forged)).toThrow()
        }
    })

    it('moves no piece from between spaces', () => {
        const game = createGame()
        const state = position(start(game), [[W, PieceKind.StraightEnd, 'C4', 0, 0]])
        const move = moveAction(game, W, 'C4', 'C9', 3)
        const forged: MovePiece = { ...move, from: aliasOf(move.from) }
        expect(() => execute(game, state, forged)).toThrow()
    })
})

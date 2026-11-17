import { describe, expect, it } from 'vitest'
import { assert, Color, GameResult, sameCoordinates, type GameAction } from '@tabletop/common'
import { DvonnRuntime } from './runtime.js'
import { DvonnVersion, versionFromConfig, WhitePlayer, whitePlayerFromConfig } from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { HydratedDvonnGameState, type DvonnGameState } from '../model/gameState.js'
import { DIRECTIONS, neighborsOf, SPACES } from '../model/geometry.js'
import { spaceFromName, spaceName } from '../model/notation.js'
import { isDvonnPiece, stackOwner, type Piece } from '../model/board.js'
import { isMoveStack, type MoveStack } from '../actions/moveStack.js'
import { isPlacePiece, type PlacePiece } from '../actions/placePiece.js'
import {
    actionBase as base,
    createGame as createTestGame,
    engine,
    execute,
    playToEnd,
    type DvonnConfig,
    type DvonnGame
} from './tests/playthrough.js'

const W = 'white'
const B = 'black'

function createGame(
    config: DvonnConfig = {},
    owner?: { ownerId: string; userIds: Record<string, string> }
) {
    return createTestGame(config, [W, B], owner)
}

function start(game: DvonnGame): DvonnGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [W, B] } }).initialState
}

function startUnassigned(game: DvonnGame): DvonnGameState {
    return engine.startGame(game).initialState
}

function lastAction(game: DvonnGame, state: DvonnGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).processedActions[0]
}

const s = spaceFromName

function placeAction(game: DvonnGame, playerId: string, name: string): PlacePiece {
    return { ...base(game, playerId), type: ActionType.PlacePiece, coords: s(name) }
}

function moveAction(game: DvonnGame, playerId: string, from: string, to: string): MoveStack {
    return { ...base(game, playerId), type: ActionType.MoveStack, from: s(from), to: s(to) }
}

const move = (game: DvonnGame, state: DvonnGameState, playerId: string, from: string, to: string) =>
    execute(game, state, moveAction(game, playerId, from, to))

function rejectsMove(
    game: DvonnGame,
    state: DvonnGameState,
    playerId: string,
    from: string,
    to: string
) {
    expect(() => move(game, state, playerId, from, to)).toThrow()
}

function fillBoard(game: DvonnGame): DvonnGameState {
    let state = start(game)
    SPACES.forEach((coords, index) => {
        const playerId = index % 2 === 0 ? W : B
        state = execute(game, state, placeAction(game, playerId, spaceName(coords)))
    })
    return state
}

// Stacks read bottom to top: w white, b black, d DVONN. Every other space is empty and White moves.
function position(game: DvonnGame, stacks: Record<string, string>): DvonnGameState {
    const state = fillBoard(game)
    state.board.stacks = Object.entries(stacks).map(([name, letters]) => {
        const placedAt = s(name)
        return {
            coords: placedAt,
            pieces: letters
                .split('')
                .map((letter): Piece =>
                    letter === 'd'
                        ? { dvonn: true, placedAt }
                        : { playerId: letter === 'w' ? W : B, placedAt }
                )
        }
    })
    return state
}

function stackAt(state: DvonnGameState, name: string): readonly Piece[] {
    return new HydratedDvonnGameState(state).board.stackAt(s(name))
}

function heightAt(state: DvonnGameState, name: string): number {
    return stackAt(state, name).length
}

describe('board', () => {
    it('has rows of 9, 10, 11, 10 and 9 spaces named A1–I1 up to C5–K5', () => {
        expect(SPACES).toHaveLength(49)
        const names = SPACES.map(spaceName)
        expect(names.filter((name) => name.endsWith('1'))).toEqual(
            'ABCDEFGHI'.split('').map((letter) => `${letter}1`)
        )
        expect(names.filter((name) => name.endsWith('5'))).toEqual(
            'CDEFGHIJK'.split('').map((letter) => `${letter}5`)
        )
        expect(names.filter((name) => name.endsWith('3'))).toHaveLength(11)
        for (const coords of SPACES) {
            expect(sameCoordinates(spaceFromName(spaceName(coords)), coords)).toBe(true)
        }
    })
})

describe('placing pieces', () => {
    it('places the DVONN pieces first, alternating from White, then White moves first', () => {
        const game = createGame()
        let state = start(game)
        expect(state.machineState).toBe(MachineState.PlacingPieces)
        expect(state.activePlayerIds).toEqual([W])

        const kinds: string[] = []
        SPACES.forEach((coords, index) => {
            const playerId = index % 2 === 0 ? W : B
            expect(state.activePlayerIds).toEqual([playerId])
            const action = lastAction(game, state, placeAction(game, playerId, spaceName(coords)))
            state = execute(game, state, placeAction(game, playerId, spaceName(coords)))
            const piece = isPlacePiece(action) ? action.metadata?.piece : undefined
            kinds.push(piece === undefined ? '?' : isDvonnPiece(piece) ? 'd' : piece.playerId)
        })
        expect(kinds.slice(0, 5)).toEqual(['d', 'd', 'd', B, W])
        expect(kinds.filter((kind) => kind === W)).toHaveLength(23)
        expect(kinds.filter((kind) => kind === B)).toHaveLength(23)
        expect(kinds.at(-1)).toBe(W)
        expect(state.machineState).toBe(MachineState.MovingStacks)
        expect(state.activePlayerIds).toEqual([W])
    })

    it('refuses an occupied space and the wrong player', () => {
        const game = createGame()
        let state = start(game)
        expect(() => execute(game, state, placeAction(game, B, 'E3'))).toThrow()
        state = execute(game, state, placeAction(game, W, 'E3'))
        expect(() => execute(game, state, placeAction(game, B, 'E3'))).toThrow()
    })
})

describe('moving stacks', () => {
    it('moves a single piece one space onto an occupied space, never onto an empty one', () => {
        const game = createGame()
        const state = position(game, { A1: 'w', B1: 'b', C1: 'd' })
        rejectsMove(game, state, W, 'A1', 'B2')
        const next = move(game, state, W, 'A1', 'B1')
        expect(heightAt(next, 'A1')).toBe(0)
        expect(stackAt(next, 'B1').map((piece) => stackOwner([piece]))).toEqual([B, W])
    })

    it('moves a stack exactly its height in a straight line, across empty spaces', () => {
        const game = createGame()
        const state = position(game, { A3: 'bw', B3: 'd', D3: 'b', C3: 'b' })
        rejectsMove(game, state, W, 'A3', 'B3')
        rejectsMove(game, state, W, 'A3', 'D3')
        const across = position(game, { A3: 'bbw', D3: 'b', C3: 'd', B3: 'b' })
        rejectsMove(game, across, W, 'A3', 'C3')
        const empty = position(game, { A3: 'bbw', D3: 'b', C3: 'd' })
        const next = move(game, empty, W, 'A3', 'D3')
        expect(heightAt(next, 'D3')).toBe(4)
        expect(stackOwner(stackAt(next, 'D3'))).toBe(W)
    })

    it('moves only stacks topped by the player’s color', () => {
        const game = createGame()
        const state = position(game, { A1: 'wb', C1: 'w', B1: 'd' })
        rejectsMove(game, state, W, 'A1', 'C1')
        rejectsMove(game, state, B, 'A1', 'C1')
    })

    it('never moves a lone DVONN piece, but moves a stack holding one', () => {
        const game = createGame()
        const state = position(game, { A1: 'w', B1: 'd', C1: 'b', D1: 'b', E1: 'd' })
        rejectsMove(game, state, W, 'B1', 'C1')
        const stacked = move(game, state, W, 'A1', 'B1')
        const next = move(game, stacked, B, 'C1', 'D1')
        const back = move(game, next, W, 'B1', 'D1')
        expect(stackAt(back, 'D1').filter(isDvonnPiece)).toHaveLength(1)
        expect(heightAt(back, 'D1')).toBe(4)
    })

    it('blocks a stack surrounded on all six sides, but not one on the edge', () => {
        const game = createGame()
        const ring = ['C2', 'E2', 'D3', 'E3', 'C1', 'D1']
        const stacks = Object.fromEntries(ring.map((name) => [name, 'b']))
        const state = position(game, { ...stacks, D2: 'w', A1: 'w', B1: 'd' })
        expect(new HydratedDvonnGameState(state).board.destinationsFrom(s('D2'))).toEqual([])
        rejectsMove(game, state, W, 'D2', 'E2')
        const next = move(game, state, W, 'A1', 'B1')
        expect(heightAt(next, 'B1')).toBe(2)
    })
})

describe('near misses', () => {
    it('does not move a stack one space short of a landing', () => {
        const game = createGame()
        const state = position(game, { A1: 'ww', B1: 'b', D1: 'd' })
        expect(new HydratedDvonnGameState(state).board.destinationsFrom(s('A1'))).toEqual([])
        rejectsMove(game, state, W, 'A1', 'B1')
        rejectsMove(game, state, W, 'A1', 'C1')
    })

    // Rule E6 counts six neighbours; a space on the edge has fewer, however full they are.
    it('moves an edge stack whose every neighbour is occupied', () => {
        const game = createGame()
        const neighbours = neighborsOf(s('A1'))
        expect(neighbours.length).toBeLessThan(DIRECTIONS.length)
        const stacks = Object.fromEntries(neighbours.map((coords) => [spaceName(coords), 'd']))
        const state = position(game, { ...stacks, A1: 'w' })
        expect(new HydratedDvonnGameState(state).board.destinationsFrom(s('A1')).length).toBe(
            neighbours.length
        )
    })
})

describe('losing pieces', () => {
    it('removes every stack cut off from the DVONN pieces, whoever owns it', () => {
        const game = createGame()
        const state = position(game, { A3: 'd', B3: 'w', C3: 'b', D3: 'w', E3: 'b', E2: 'b' })
        const action = lastAction(game, state, moveAction(game, W, 'B3', 'C3'))
        const next = move(game, state, W, 'B3', 'C3')
        expect(heightAt(next, 'A3')).toBe(1)
        for (const name of ['C3', 'D3', 'E3', 'E2']) {
            expect(heightAt(next, name)).toBe(0)
        }
        expect(
            isMoveStack(action) ? action.metadata?.removed.map((r) => spaceName(r.coords)) : []
        ).toEqual(expect.arrayContaining(['C3', 'D3', 'E3', 'E2']))
    })

    it('keeps an isolated DVONN piece on the board', () => {
        const game = createGame()
        const state = position(game, { A1: 'w', B1: 'd', E1: 'd', F3: 'b', G3: 'w' })
        const next = move(game, state, W, 'A1', 'B1')
        expect(heightAt(next, 'E1')).toBe(1)
        expect(heightAt(next, 'F3')).toBe(0)
    })
})

describe('passing and the end', () => {
    it('passes a player without a move automatically and lets the other play on', () => {
        const game = createGame()
        const state = position(game, { E3: 'wb', F3: 'd', K3: 'w', J3: 'd', I3: 'w' })
        const action = lastAction(game, state, moveAction(game, W, 'K3', 'J3'))
        expect(isMoveStack(action) ? action.metadata?.passedPlayerId : undefined).toBe(B)
        const next = move(game, state, W, 'K3', 'J3')
        expect(next.activePlayerIds).toEqual([W])
        expect(next.machineState).toBe(MachineState.MovingStacks)
    })

    it('ends when neither can move; controlled pieces, DVONN included, score', () => {
        const game = createGame()
        const state = position(game, { A1: 'w', B1: 'd', E3: 'dbb' })
        const next = move(game, state, W, 'A1', 'B1')
        expect(next.machineState).toBe(MachineState.EndOfGame)
        const hydrated = new HydratedDvonnGameState(next)
        expect([hydrated.score(W), hydrated.score(B)]).toEqual([2, 3])
        expect(DvonnRuntime.scoring?.finalScores(next)).toEqual({ [W]: 0, [B]: 1 })
        expect(next.winningPlayerIds).toEqual([B])
        expect(next.result).toBe(GameResult.Win)
    })

    it('draws on equal stacks', () => {
        const game = createGame()
        const state = position(game, { A1: 'w', B1: 'd', E3: 'db' })
        const next = move(game, state, W, 'A1', 'B1')
        expect(next.machineState).toBe(MachineState.EndOfGame)
        expect(next.result).toBe(GameResult.Draw)
        expect(next.winningPlayerIds).toEqual(expect.arrayContaining([W, B]))
    })

    it('gives a blocked player the turn back once a move opens up', () => {
        const game = createGame()
        const ring = { C2: 'd', E2: 'w', D3: 'w', E3: 'w', C1: 'w', D1: 'w' }
        const state = position(game, { ...ring, D2: 'b', B1: 'w', H3: 'w', I3: 'w' })
        const passed = move(game, state, W, 'H3', 'I3')
        expect(passed.activePlayerIds).toEqual([W])
        const opened = move(game, passed, W, 'C1', 'B1')
        expect(opened.activePlayerIds).toEqual([B])
    })
})

describe('the first move', () => {
    // White places only inside the board and Black only on its edge, so once the board is full
    // every White stack is surrounded and White, who should move first, cannot.
    it('passes White when the last placement leaves them no move, and records it', () => {
        const game = createGame()
        const inside = SPACES.filter((coords) => neighborsOf(coords).length === DIRECTIONS.length)
        const edge = SPACES.filter((coords) => neighborsOf(coords).length < DIRECTIONS.length)
        // The DVONN pieces go first (White, Black, White), then the players alternate.
        const order = [inside[0], edge[0], inside[1]]
        const whites = inside.slice(2)
        const blacks = edge.slice(1)
        while (whites.length + blacks.length > 0) {
            const next = order.length % 2 === 0 ? whites.shift() : blacks.shift()
            assert(next !== undefined, 'White and Black place alternately')
            order.push(next)
        }
        let state = start(game)
        const last = order.pop()
        assert(last !== undefined, 'The board has spaces')
        for (const coords of order) {
            state = execute(
                game,
                state,
                placeAction(game, state.activePlayerIds[0], spaceName(coords))
            )
        }
        expect(state.activePlayerIds).toEqual([W])
        const placed = lastAction(game, state, placeAction(game, W, spaceName(last)))
        assert(isPlacePiece(placed), 'The placement is processed')
        expect(placed.metadata?.passedPlayerId).toBe(W)
        const after = execute(game, state, placeAction(game, W, spaceName(last)))
        expect(after.machineState).toBe(MachineState.MovingStacks)
        expect(after.activePlayerIds).toEqual([B])
    })
})

describe('setup options', () => {
    it('gives White to the game creator or the opponent when chosen', () => {
        const owner = { ownerId: 'u-black', userIds: { [W]: 'u-white', [B]: 'u-black' } }
        const creatorWhite = startUnassigned(
            createGame({ whitePlayer: WhitePlayer.Creator }, owner)
        )
        const whiteOf = (state: DvonnGameState) =>
            state.players.find((player) => player.color === Color.White)?.playerId
        expect(whiteOf(creatorWhite)).toBe(B)
        expect(creatorWhite.activePlayerIds).toEqual([B])
        const opponentWhite = startUnassigned(
            createGame({ whitePlayer: WhitePlayer.Opponent }, owner)
        )
        expect(whiteOf(opponentWhite)).toBe(W)
    })

    // The rulebook draws lots; Random leaves it to the seeded draw.
    it('draws White by lot when Random, and when the creator does not play', () => {
        const whiteOf = (state: DvonnGameState) =>
            state.players.find((player) => player.color === Color.White)?.playerId
        const outsider = { ownerId: 'u-host', userIds: { [W]: 'u-white', [B]: 'u-black' } }
        for (const [config, owner] of [
            [{ whitePlayer: WhitePlayer.Random }, undefined],
            [{ whitePlayer: WhitePlayer.Creator }, outsider],
            [{ whitePlayer: WhitePlayer.Opponent }, outsider]
        ] as const) {
            const whites = new Set(
                [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
                    const state = startUnassigned({ ...createGame(config, owner), seed })
                    expect(state.activePlayerIds).toEqual([whiteOf(state)])
                    return whiteOf(state)
                })
            )
            expect(whites).toEqual(new Set([W, B]))
        }
    })

    it('reads a missing option as its default and rejects an unknown one', () => {
        expect(versionFromConfig({})).toBe(DvonnVersion.Standard)
        expect(whitePlayerFromConfig({})).toBe(WhitePlayer.Random)
        expect(() => versionFromConfig({ version: 'Bogus' })).toThrow()
        expect(() => whitePlayerFromConfig({ whitePlayer: 'Bogus' })).toThrow()
    })

    it('fills the board at random and starts with White stacking', () => {
        const game = createGame({ version: DvonnVersion.RandomPlacement })
        const state = start(game)
        expect(state.machineState).toBe(MachineState.MovingStacks)
        expect(state.board.stacks).toHaveLength(SPACES.length)
        expect(state.board.stacks.every((stack) => stack.pieces.length === 1)).toBe(true)
        const pieces = state.board.stacks.map((stack) => stack.pieces[0])
        expect(pieces.filter(isDvonnPiece)).toHaveLength(3)
        expect(pieces.filter((piece) => stackOwner([piece]) === W)).toHaveLength(23)
        expect(state.activePlayerIds).toEqual([W])
    })
})

describe('random playouts', () => {
    it.each(
        Object.values(DvonnVersion).flatMap((version) =>
            Array.from({ length: 12 }, (_, seed) => [version, seed] as const)
        )
    )('%s seed %i plays to a result', (version, seed) => {
        const game = { ...createGame({ version }), seed: seed + 1 }
        const state = playToEnd(game, start(game), seed)
        expect(state.winningPlayerIds.length).toBeGreaterThan(0)
        const hydrated = new HydratedDvonnGameState(state)
        const best = Math.max(...state.players.map((player) => hydrated.score(player.playerId)))
        for (const winner of state.winningPlayerIds) expect(hydrated.score(winner)).toBe(best)
        // Nothing reads past turns, so the series keeps only each player's latest.
        expect(state.turnManager.series.length).toBeLessThanOrEqual(2)
    })
})

describe('piece identity', () => {
    it('keeps the space each piece was placed on as it moves', () => {
        const game = createGame()
        const state = fillBoard(game)
        expect(stackAt(state, 'A1')[0].placedAt).toEqual(s('A1'))
        const next = move(game, state, W, 'A1', 'B1')
        expect(stackAt(next, 'B1').map((piece) => spaceName(piece.placedAt))).toEqual(['B1', 'A1'])
    })
})

describe('submitted coordinates', () => {
    it('places no piece between spaces', () => {
        const game = createGame()
        const state = start(game)
        for (const coords of [
            { q: -0.5, r: 0 },
            { q: 0.25, r: 0 }
        ]) {
            const action = { ...placeAction(game, W, 'E3'), coords }
            expect(() => execute(game, state, action)).toThrow()
        }
    })
})

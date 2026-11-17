import { describe, expect, it } from 'vitest'
import {
    assert,
    GameResult,
    sameCoordinates,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import { YinshRuntime } from './runtime.js'
import { YinshVersion, versionFromConfig, WhitePlayer, whitePlayerFromConfig } from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import {
    EndReason,
    HydratedYinshGameState,
    MARKERS,
    type YinshGameState
} from '../model/gameState.js'
import { POINTS } from '../model/geometry.js'
import { pointFromName, pointName } from '../model/notation.js'
import type { PlaceRing } from '../actions/placeRing.js'
import { isMoveRing, type MoveRing } from '../actions/moveRing.js'
import type { RemoveRow } from '../actions/removeRow.js'
import type { RemoveRing } from '../actions/removeRing.js'
import {
    actionBase as base,
    createGame,
    engine,
    execute,
    playToEnd,
    type YinshGame
} from './tests/playthrough.js'

const W = 'white'
const B = 'black'

function start(game: YinshGame): YinshGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [W, B] } }).initialState
}

function rejects(game: YinshGame, state: YinshGameState, action: GameAction) {
    expect(() => execute(game, state, action)).toThrow()
}

const p = pointFromName

function placeAction(game: YinshGame, playerId: string, coords: AxialCoordinates): PlaceRing {
    return { ...base(game, playerId), type: ActionType.PlaceRing, coords }
}

function moveAction(game: YinshGame, playerId: string, from: string, to: string): MoveRing {
    return { ...base(game, playerId), type: ActionType.MoveRing, from: p(from), to: p(to) }
}

function rowAction(game: YinshGame, playerId: string, from: string, to: string): RemoveRow {
    return { ...base(game, playerId), type: ActionType.RemoveRow, from: p(from), to: p(to) }
}

function ringAction(game: YinshGame, playerId: string, coords: string): RemoveRing {
    return { ...base(game, playerId), type: ActionType.RemoveRing, coords: p(coords) }
}

const move = (game: YinshGame, state: YinshGameState, playerId: string, from: string, to: string) =>
    execute(game, state, moveAction(game, playerId, from, to))
const takeRow = (
    game: YinshGame,
    state: YinshGameState,
    playerId: string,
    from: string,
    to: string
) => execute(game, state, rowAction(game, playerId, from, to))
const takeRing = (game: YinshGame, state: YinshGameState, playerId: string, coords: string) =>
    execute(game, state, ringAction(game, playerId, coords))

const SPARE_RINGS: Record<string, string[]> = {
    [W]: ['A2', 'B1', 'C1', 'D1', 'E1'],
    [B]: ['K10', 'J11', 'I11', 'H11', 'G11']
}

// Places five rings each through the engine (the named ones first, then corner spares), then
// takes off the last spares for rings already removed and writes the markers, leaving White to move.
function position(
    game: YinshGame,
    rings: Record<string, string[]>,
    markers: Record<string, string[]> = {},
    ringsRemoved: Record<string, number> = {}
): YinshGameState {
    let state = start(game)
    const toPlace = (playerId: string) =>
        [
            ...rings[playerId],
            ...SPARE_RINGS[playerId].filter((name) => !rings[playerId].includes(name))
        ].slice(0, 5)
    const white = toPlace(W)
    const black = toPlace(B)
    for (let index = 0; index < 5; index++) {
        state = execute(game, state, placeAction(game, W, p(white[index])))
        state = execute(game, state, placeAction(game, B, p(black[index])))
    }
    const next = withMarkers(state, markers)
    for (const player of next.players) {
        const removed = ringsRemoved[player.playerId] ?? 0
        const placed = toPlace(player.playerId)
        for (const name of placed.slice(placed.length - removed)) {
            const ring = next.board.rings.find((candidate) =>
                sameCoordinates(candidate.coords, p(name))
            )
            if (ring === undefined) throw Error(`no ring on ${name}`)
            next.board.rings = next.board.rings.filter((candidate) => candidate !== ring)
            player.removedRingIds.push(ring.id)
        }
    }
    return next
}

function withMarkers(state: YinshGameState, markers: Record<string, string[]>): YinshGameState {
    const next = structuredClone(state)
    for (const [playerId, names] of Object.entries(markers)) {
        for (const name of names) {
            next.board.markers.push({ coords: p(name), playerId })
        }
    }
    return next
}

const ringsRemovedBy = (state: YinshGameState, playerId: string) =>
    hydrate(state).getPlayerState(playerId).ringsRemoved

const hydrate = (state: YinshGameState) => new HydratedYinshGameState(state)
const markerAt = (state: YinshGameState, name: string) => hydrate(state).board.markerAt(p(name))
const ringAt = (state: YinshGameState, name: string) => hydrate(state).board.ringAt(p(name))

describe('board', () => {
    it('has 85 points in columns of 4, 7, 8, 9, 10, 9, 10, 9, 8, 7, 4', () => {
        expect(POINTS).toHaveLength(85)
        const columns = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(
            (q) => POINTS.filter((point) => point.q === q).length
        )
        expect(columns).toEqual([4, 7, 8, 9, 10, 9, 10, 9, 8, 7, 4])
    })

    it('names the column ends as printed on the board', () => {
        const ends = 'ABCDEFGHIJK'.split('').map((letter) => {
            const names = POINTS.filter((point) => pointName(point)[0] === letter).map((point) =>
                Number(pointName(point).slice(1))
            )
            return `${letter}${Math.min(...names)}-${letter}${Math.max(...names)}`
        })
        expect(ends).toEqual([
            'A2-A5',
            'B1-B7',
            'C1-C8',
            'D1-D9',
            'E1-E10',
            'F2-F10',
            'G2-G11',
            'H3-H11',
            'I4-I11',
            'J5-J11',
            'K7-K10'
        ])
        for (const point of POINTS) {
            expect(pointFromName(pointName(point))).toEqual(point)
        }
    })
})

describe('choice of White', () => {
    const whiteOf = (state: YinshGameState) =>
        state.players.find((player) => player.color === 'white')?.playerId
    const startUnassigned = (game: YinshGame) => engine.startGame(game).initialState

    it('gives White and the first placement to the game creator or the opponent when chosen', () => {
        const owner = { ownerId: 'u-black', userIds: { [W]: 'u-white', [B]: 'u-black' } }
        const creatorWhite = startUnassigned(
            createGame(YinshVersion.Standard, [W, B], {
                ...owner,
                whitePlayer: WhitePlayer.Creator
            })
        )
        expect(whiteOf(creatorWhite)).toBe(B)
        expect(creatorWhite.activePlayerIds).toEqual([B])
        const opponentWhite = startUnassigned(
            createGame(YinshVersion.Standard, [W, B], {
                ...owner,
                whitePlayer: WhitePlayer.Opponent
            })
        )
        expect(whiteOf(opponentWhite)).toBe(W)
        expect(opponentWhite.activePlayerIds).toEqual([W])
    })

    it('draws White by lot when Random, and when the creator does not play', () => {
        const outsider = { ownerId: 'u-host', userIds: { [W]: 'u-white', [B]: 'u-black' } }
        for (const options of [
            { whitePlayer: WhitePlayer.Random },
            { ...outsider, whitePlayer: WhitePlayer.Creator },
            { ...outsider, whitePlayer: WhitePlayer.Opponent }
        ]) {
            const whites = new Set(
                [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
                    const game = { ...createGame(YinshVersion.Standard, [W, B], options), seed }
                    const state = startUnassigned(game)
                    expect(state.activePlayerIds).toEqual([whiteOf(state)])
                    return whiteOf(state)
                })
            )
            expect(whites).toEqual(new Set([W, B]))
        }
    })

    it('reads a missing choice as Random and rejects an unknown one', () => {
        expect(whitePlayerFromConfig({})).toBe(WhitePlayer.Random)
        expect(() => whitePlayerFromConfig({ whitePlayer: 'Bogus' })).toThrow()
    })
})

describe('placing rings', () => {
    it('alternates placements, White first, then White moves', () => {
        const game = createGame()
        let state = start(game)
        expect(state.machineState).toBe(MachineState.PlacingRings)
        expect(state.activePlayerIds).toEqual([W])
        rejects(game, state, placeAction(game, B, p('F5')))
        state = execute(game, state, placeAction(game, W, p('F5')))
        expect(state.activePlayerIds).toEqual([B])
        rejects(game, state, placeAction(game, B, p('F5')))
        state = position(game, { [W]: [], [B]: [] })
        expect(state.machineState).toBe(MachineState.MovingRing)
        expect(state.activePlayerIds).toEqual([W])
        expect(hydrate(state).board.ringsOf(W)).toHaveLength(5)
        expect(hydrate(state).board.ringsOf(B)).toHaveLength(5)
    })

    it('gives White the first player', () => {
        const state = start(createGame())
        expect(state.players.find((player) => player.playerId === W)?.color).toBe('white')
    })

    // Rule C2, whoever the seating puts first.
    it('gives White the first player without a seating', () => {
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            const game = { ...createGame(), seed }
            const state = engine.startGame(game).initialState
            const first = state.turnManager.turnOrder[0]
            expect(state.activePlayerIds).toEqual([first])
            const colorOf = (playerId: string) =>
                state.players.find((player) => player.playerId === playerId)?.color
            expect(colorOf(first)).toBe('white')
            expect(colorOf(state.turnManager.turnOrder[1])).toBe('black')
        }
    })
})

describe('moving a ring', () => {
    it('leaves a marker of the mover’s color and moves over vacant points', () => {
        const game = createGame()
        let state = position(game, { [W]: ['F3'], [B]: [] })
        state = move(game, state, W, 'F3', 'F8')
        expect(markerAt(state, 'F3')).toBe(W)
        expect(ringAt(state, 'F8')).toBe(W)
        expect(ringAt(state, 'F3')).toBeUndefined()
        expect(state.activePlayerIds).toEqual([B])
    })

    it('jumps a run of markers to the first vacant point and flips them', () => {
        const game = createGame()
        let state = position(game, { [W]: ['F3'], [B]: [] }, { [W]: ['F5'], [B]: ['F6', 'F7'] })
        rejects(game, state, moveAction(game, W, 'F3', 'F9'))
        rejects(game, state, moveAction(game, W, 'F3', 'F5'))
        state = move(game, state, W, 'F3', 'F8')
        expect(['F3', 'F5', 'F6', 'F7'].map((name) => markerAt(state, name))).toEqual([W, B, W, W])
    })

    it('may cross vacant points before the jump', () => {
        const game = createGame()
        const state = position(game, { [W]: ['F3'], [B]: [] }, { [B]: ['F7'] })
        const moves = hydrate(state)
            .board.movesFrom(p('F3'))
            .filter((m) => m.to.q === 0)
            .map((m) => pointName(m.to))
        expect(moves).toEqual(expect.arrayContaining(['F2', 'F4', 'F5', 'F6', 'F8']))
        expect(moves).not.toContain('F9')
    })

    it('cannot pass a ring', () => {
        const game = createGame()
        const state = position(game, { [W]: ['F3'], [B]: ['F6'] }, { [W]: ['F4'] })
        rejects(game, state, moveAction(game, W, 'F3', 'F7'))
        rejects(game, state, moveAction(game, W, 'F3', 'F6'))
        expect(() => move(game, state, W, 'F3', 'F5')).not.toThrow()
    })

    it('moves only the player’s own rings', () => {
        const game = createGame()
        const state = position(game, { [W]: ['F3'], [B]: ['D4'] })
        rejects(game, state, moveAction(game, W, 'D4', 'D5'))
    })
})

describe('ring ids', () => {
    const ringIdAt = (state: YinshGameState, name: string) => hydrate(state).board.ringIdAt(p(name))

    it('numbers rings in placing order and moves each id with its ring', () => {
        const game = createGame()
        let state = position(game, { [W]: ['F3'], [B]: ['G9'] })
        expect(ringIdAt(state, 'F3')).toBe(0)
        expect(ringIdAt(state, 'G9')).toBe(1)
        state = move(game, state, W, 'F3', 'F8')
        expect(ringIdAt(state, 'F8')).toBe(0)
        expect(ringIdAt(state, 'F3')).toBeUndefined()
    })

    it('keeps the ids of removed rings in order', () => {
        const game = createGame()
        let state = position(game, { [W]: ['F3'], [B]: [] }, { [W]: ['B3', 'C3', 'D3', 'E3'] })
        state = move(game, state, W, 'F3', 'F9')
        state = takeRow(game, state, W, 'F3', 'B3')
        state = takeRing(game, state, W, 'F9')
        const white = state.players.find((player) => player.playerId === W)
        expect(white?.removedRingIds).toEqual([0])
    })
})

describe('rows', () => {
    it('takes the mover’s row and then one of their rings', () => {
        const game = createGame()
        let state = position(game, { [W]: ['F3'], [B]: [] }, { [W]: ['B3', 'C3', 'D3', 'E3'] })
        state = move(game, state, W, 'F3', 'F9')
        expect(state.machineState).toBe(MachineState.RemovingRow)
        expect(state.activePlayerIds).toEqual([W])
        rejects(game, state, rowAction(game, W, 'B3', 'E3'))
        state = takeRow(game, state, W, 'F3', 'B3')
        expect(markerAt(state, 'D3')).toBeUndefined()
        expect(state.machineState).toBe(MachineState.RemovingRing)
        rejects(game, state, ringAction(game, W, 'K10'))
        state = takeRing(game, state, W, 'F9')
        expect(ringAt(state, 'F9')).toBeUndefined()
        expect(ringsRemovedBy(state, W)).toBe(1)
        expect(state.machineState).toBe(MachineState.MovingRing)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('lets the player choose five of a longer row', () => {
        const game = createGame()
        let state = position(
            game,
            { [W]: ['F3'], [B]: [] },
            { [W]: ['B3', 'C3', 'D3', 'E3', 'G3', 'H3'] }
        )
        state = move(game, state, W, 'F3', 'F9')
        rejects(game, state, rowAction(game, W, 'B3', 'G3'))
        state = takeRow(game, state, W, 'D3', 'H3')
        expect(markerAt(state, 'B3')).toBe(W)
        expect(markerAt(state, 'C3')).toBe(W)
        state = takeRing(game, state, W, 'F9')
        expect(state.activePlayerIds).toEqual([B])
    })

    it('takes two separate rows and two rings', () => {
        const game = createGame()
        let state = position(
            game,
            { [W]: ['F3'], [B]: [] },
            { [W]: ['B4', 'C4', 'D4', 'E4', 'B5', 'C5', 'D5', 'E5'], [B]: ['F4', 'F5'] }
        )
        state = move(game, state, W, 'F3', 'F6')
        expect(state.machineState).toBe(MachineState.RemovingRow)
        state = takeRow(game, state, W, 'B4', 'F4')
        state = takeRing(game, state, W, 'F6')
        expect(state.machineState).toBe(MachineState.RemovingRow)
        expect(state.activePlayerIds).toEqual([W])
        state = takeRow(game, state, W, 'F5', 'B5')
        state = takeRing(game, state, W, 'A2')
        expect(ringsRemovedBy(state, W)).toBe(2)
        expect(state.machineState).toBe(MachineState.MovingRing)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('counts crossing rows once', () => {
        const game = createGame()
        let state = position(
            game,
            { [W]: ['F3'], [B]: [] },
            { [W]: ['B4', 'C4', 'D4', 'E4', 'G5', 'H6', 'I7', 'J8'], [B]: ['F4'] }
        )
        state = move(game, state, W, 'F3', 'F5')
        expect(hydrate(state).board.rowsOf(W)).toHaveLength(2)
        state = takeRow(game, state, W, 'B4', 'F4')
        state = takeRing(game, state, W, 'F5')
        expect(state.machineState).toBe(MachineState.MovingRing)
        expect(markerAt(state, 'G5')).toBe(W)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('does not count rings in a row', () => {
        const game = createGame()
        const state = position(game, { [W]: ['F3', 'D3'], [B]: [] }, { [W]: ['B3', 'C3', 'E3'] })
        const next = move(game, state, W, 'F3', 'F9')
        expect(next.machineState).toBe(MachineState.MovingRing)
        expect(next.activePlayerIds).toEqual([B])
    })

    it('lets the opponent take a row the mover made, before their move', () => {
        const game = createGame()
        let state = position(
            game,
            { [W]: ['F4'], [B]: [] },
            { [B]: ['B3', 'C3', 'D3', 'E3'], [W]: ['F3'] }
        )
        state = move(game, state, W, 'F4', 'F2')
        expect(markerAt(state, 'F3')).toBe(B)
        expect(state.machineState).toBe(MachineState.RemovingRow)
        expect(state.activePlayerIds).toEqual([B])
        state = takeRow(game, state, B, 'B3', 'F3')
        state = takeRing(game, state, B, 'K10')
        expect(state.machineState).toBe(MachineState.MovingRing)
        expect(state.activePlayerIds).toEqual([B])
    })

    it('resolves the mover’s row before the opponent’s', () => {
        const game = createGame()
        let state = position(
            game,
            { [W]: ['F4'], [B]: [] },
            { [B]: ['B3', 'C3', 'D3', 'E3'], [W]: ['F3', 'B4', 'C4', 'D4', 'E4'] }
        )
        state = move(game, state, W, 'F4', 'F2')
        expect(state.activePlayerIds).toEqual([W])
        rejects(game, state, rowAction(game, B, 'B3', 'F3'))
        state = takeRow(game, state, W, 'B4', 'F4')
        state = takeRing(game, state, W, 'F2')
        expect(state.machineState).toBe(MachineState.RemovingRow)
        expect(state.activePlayerIds).toEqual([B])
    })
})

describe('winning', () => {
    it('wins on the third ring', () => {
        const game = createGame()
        let state = position(
            game,
            { [W]: ['F3'], [B]: [] },
            { [W]: ['B3', 'C3', 'D3', 'E3'] },
            { [W]: 2 }
        )
        state = move(game, state, W, 'F3', 'F9')
        state = takeRow(game, state, W, 'B3', 'F3')
        state = takeRing(game, state, W, 'F9')
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual([W])
        expect(state.endReason).toBe(EndReason.Rows)
        expect(state.resolvingPlayerIds).toEqual([])
        expect(YinshRuntime.scoring?.finalScores(state)).toEqual({ [W]: 1, [B]: 0 })
    })

    it('gives the mover the win when both third rows form in one move', () => {
        const game = createGame()
        let state = position(
            game,
            { [W]: ['F4'], [B]: [] },
            { [B]: ['B3', 'C3', 'D3', 'E3'], [W]: ['F3', 'B4', 'C4', 'D4', 'E4'] },
            { [W]: 2, [B]: 2 }
        )
        state = move(game, state, W, 'F4', 'F2')
        state = takeRow(game, state, W, 'B4', 'F4')
        state = takeRing(game, state, W, 'F2')
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual([W])
    })

    it('lets the opponent win on a row the mover made for them', () => {
        const game = createGame()
        let state = position(
            game,
            { [W]: ['F4'], [B]: ['K10'] },
            { [B]: ['B3', 'C3', 'D3', 'E3'], [W]: ['F3'] },
            { [B]: 2 }
        )
        state = move(game, state, W, 'F4', 'F2')
        state = takeRow(game, state, B, 'B3', 'F3')
        state = takeRing(game, state, B, 'K10')
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual([B])
    })

    it('wins Blitz on the first row', () => {
        const game = createGame(YinshVersion.Blitz)
        let state = position(game, { [W]: ['F3'], [B]: [] }, { [W]: ['B3', 'C3', 'D3', 'E3'] })
        state = move(game, state, W, 'F3', 'F9')
        state = takeRow(game, state, W, 'B3', 'F3')
        state = takeRing(game, state, W, 'F9')
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual([W])
    })
})

// Coloring markers White only where (q - r) is a multiple of 3 never puts five of one color in a
// line, in any direction.
function filler(state: YinshGameState, count: number, keepVacant: string[]): YinshGameState {
    const next = structuredClone(state)
    const board = hydrate(next).board
    const vacant = keepVacant.map(p)
    let placed = 0
    for (const coords of POINTS) {
        if (placed === count) break
        const reserved = vacant.some((other) => sameCoordinates(other, coords))
        if (reserved || !board.isVacant(coords)) continue
        next.board.markers.push({
            coords,
            playerId: (((coords.q - coords.r) % 3) + 3) % 3 === 0 ? W : B
        })
        placed += 1
    }
    expect(placed).toBe(count)
    return next
}

describe('end of the pool', () => {
    it('ends when the last marker is placed, most rings removed winning', () => {
        const game = createGame()
        let state = position(game, { [W]: ['F3'], [B]: [] }, {}, { [B]: 1 })
        state = filler(state, MARKERS - 1, ['F3', 'F4'])
        expect(hydrate(state).board.hasRow(W) || hydrate(state).board.hasRow(B)).toBe(false)
        state = move(game, state, W, 'F3', 'F4')
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.endReason).toBe(EndReason.PoolEmpty)
        expect(state.winningPlayerIds).toEqual([B])
    })

    it('draws on equal rings removed', () => {
        const game = createGame()
        let state = position(game, { [W]: ['F3'], [B]: [] })
        state = filler(state, MARKERS - 1, ['F3', 'F4'])
        state = move(game, state, W, 'F3', 'F4')
        expect(state.result).toBe(GameResult.Draw)
        expect(state.winningPlayerIds).toEqual([W, B])
        expect(YinshRuntime.scoring?.finalScores(state)).toEqual({ [W]: 1, [B]: 1 })
    })

    it('plays on when the last marker completes a row', () => {
        const game = createGame()
        let state = position(game, { [W]: ['F3'], [B]: [] }, { [W]: ['B3', 'C3', 'D3', 'E3'] })
        state = filler(state, MARKERS - 5, ['F3', 'F4', 'A3', 'A4', 'A5'])
        state = move(game, state, W, 'F3', 'F4')
        expect(hydrate(state).markersInPool()).toBe(0)
        state = takeRow(game, state, W, 'B3', 'F3')
        state = takeRing(game, state, W, 'F4')
        expect(state.machineState).toBe(MachineState.MovingRing)
        expect(hydrate(state).markersInPool()).toBe(5)
    })
})

describe('blocked rings', () => {
    // Black's rings fill column K; White's rings and the K7 marker shut every line out of it.
    const pocket = (game: YinshGame) =>
        position(
            game,
            { [W]: ['J7', 'J8', 'J9', 'J10', 'F3'], [B]: ['K8', 'K9', 'K10'] },
            { [W]: ['K7'] },
            { [B]: 2 }
        )

    it('passes a player who cannot move, and records the pass', () => {
        const game = createGame()
        const state = pocket(game)
        expect(hydrate(state).canMove(B)).toBe(false)
        const { updatedState, processedActions } = engine.executeCanonicalAction({
            game,
            state,
            action: moveAction(game, W, 'F3', 'F4')
        })
        expect(updatedState.machineState).toBe(MachineState.MovingRing)
        expect(updatedState.activePlayerIds).toEqual([W])
        const [moved] = processedActions
        assert(isMoveRing(moved), 'The move is processed')
        expect(moved.metadata).toEqual({ flipped: [], passedPlayerId: B })
    })

    it('records no pass when the opponent can move', () => {
        const game = createGame()
        const state = position(game, { [W]: ['F3'], [B]: [] })
        const { processedActions } = engine.executeCanonicalAction({
            game,
            state,
            action: moveAction(game, W, 'F3', 'F4')
        })
        const [moved] = processedActions
        assert(isMoveRing(moved), 'The move is processed')
        expect(moved.metadata).toEqual({ flipped: [] })
    })

    // Agreed reading: when neither player can move, the game ends as on an empty pool. White's
    // I4 to J5 shuts the last gap in a cluster of rings walled in by markers.
    it('ends the game when neither player can move, most rings removed winning', () => {
        const game = createGame()
        let state = position(
            game,
            { [W]: ['I4', 'J6', 'K7'], [B]: ['I5', 'J7', 'I6'] },
            {
                [W]: [
                    'A5',
                    'B6',
                    'B7',
                    'D6',
                    'E5',
                    'E6',
                    'E7',
                    'F2',
                    'F3',
                    'F5',
                    'F6',
                    'G2',
                    'G3',
                    'G4',
                    'H6',
                    'H7',
                    'I10',
                    'I11',
                    'I7',
                    'J10',
                    'J9',
                    'K10',
                    'K9'
                ],
                [B]: [
                    'B5',
                    'C5',
                    'C6',
                    'C7',
                    'D1',
                    'D5',
                    'D7',
                    'E1',
                    'E2',
                    'F7',
                    'G5',
                    'G6',
                    'G7',
                    'H3',
                    'H4',
                    'H5',
                    'I8',
                    'I9',
                    'J11',
                    'J8',
                    'K8'
                ]
            },
            { [W]: 2, [B]: 2 }
        )
        expect(hydrate(state).canMove(B)).toBe(true)
        state = move(game, state, W, 'I4', 'J5')
        expect(hydrate(state).markersInPool()).toBeGreaterThan(0)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.endReason).toBe(EndReason.NoMoves)
        expect(state.result).toBe(GameResult.Draw)
        expect(state.winningPlayerIds).toEqual([W, B])
    })
})

describe('configuration', () => {
    it('reads a missing version as Standard and rejects an unknown one', () => {
        expect(versionFromConfig({})).toBe(YinshVersion.Standard)
        expect(versionFromConfig({ version: 'Blitz' })).toBe(YinshVersion.Blitz)
        expect(() => versionFromConfig({ version: 'Lightning' })).toThrow()
    })
})

describe('random playouts', () => {
    it.each(
        Object.values(YinshVersion).flatMap((version) =>
            Array.from({ length: 12 }, (_, seed) => [version, seed] as const)
        )
    )('%s seed %i plays to a result', (version, seed) => {
        const game = { ...createGame(version), seed: seed + 1 }
        const finished = playToEnd(game, start(game), seed)
        expect(finished.winningPlayerIds.length).toBeGreaterThan(0)
        expect(finished.endReason).toBeDefined()
        // Nothing reads past turns, so the series keeps only each player's latest.
        expect(finished.turnManager.series.length).toBeLessThanOrEqual(2)
    })
})

describe('submitted coordinates', () => {
    it('places no ring off the points', () => {
        const game = createGame()
        const state = start(game)
        rejects(game, state, placeAction(game, W, { q: 0.25, r: 0 }))
        rejects(game, state, placeAction(game, W, { q: -0.5, r: 0 }))
    })

    it('checks both ends of a row before reading the points between them', () => {
        const game = createGame()
        let state = position(game, { [W]: ['F3'], [B]: [] }, { [W]: ['B3', 'C3', 'D3', 'E3'] })
        state = move(game, state, W, 'F3', 'F9')
        const row = rowAction(game, W, 'F3', 'B3')
        const step = { q: (row.to.q - row.from.q) / 4, r: (row.to.r - row.from.r) / 4 }
        const past = (by: number) => ({ q: row.to.q + step.q * by, r: row.to.r + step.r * by })
        for (const to of [past(0.25), past(1e9)]) {
            const forged: RemoveRow = { ...row, to }
            rejects(game, state, forged)
        }
    })
})

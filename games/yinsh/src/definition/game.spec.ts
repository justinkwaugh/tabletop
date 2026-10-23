import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    GameResult,
    PlayerStatus,
    sameCoordinates,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import { Definition } from './definition.js'
import { YinshRuntime } from './runtime.js'
import { YinshInfo } from './info.js'
import { YinshVersion } from './config.js'
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
import type { MoveRing } from '../actions/moveRing.js'
import type { RemoveRow } from '../actions/removeRow.js'
import type { RemoveRing } from '../actions/removeRing.js'

const engine = new GameEngine(YinshRuntime)
const W = 'white'
const B = 'black'

function createGame(version: YinshVersion = YinshVersion.Standard) {
    return YinshRuntime.initializer.initializeGame(
        {
            id: 'yinsh-test',
            typeId: 'yinsh',
            ownerId: 'owner',
            seed: 5,
            config: { ...defaultGameConfig(YinshInfo.configurator?.options ?? []), version },
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

type YinshGame = ReturnType<typeof createGame>

function start(game: YinshGame): YinshGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [W, B] } }).initialState
}

let counter = 0
function base(game: YinshGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

function execute(game: YinshGame, state: YinshGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
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
        player.ringsRemoved = removed
        const placed = toPlace(player.playerId)
        for (const name of placed.slice(placed.length - removed)) {
            const point = pointIn(next, name)
            delete point.ringPlayerId
        }
    }
    return next
}

function pointIn(state: YinshGameState, name: string) {
    const point = state.board.points.find((candidate) => sameCoordinates(candidate.coords, p(name)))
    if (point === undefined) throw Error(`not a point: ${name}`)
    return point
}

function withMarkers(state: YinshGameState, markers: Record<string, string[]>): YinshGameState {
    const next = structuredClone(state)
    for (const [playerId, names] of Object.entries(markers)) {
        for (const name of names) {
            pointIn(next, name).markerPlayerId = playerId
        }
    }
    return next
}

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
        expect(state.players.find((player) => player.playerId === W)?.ringsRemoved).toBe(1)
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
        expect(state.players.find((player) => player.playerId === W)?.ringsRemoved).toBe(2)
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
    const vacant = keepVacant.map(p)
    let placed = 0
    for (const point of next.board.points) {
        if (placed === count) break
        const reserved = vacant.some((coords) => sameCoordinates(coords, point.coords))
        if (reserved || point.ringPlayerId !== undefined || point.markerPlayerId !== undefined) {
            continue
        }
        point.markerPlayerId = (((point.coords.q - point.coords.r) % 3) + 3) % 3 === 0 ? W : B
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

    it('passes a player who cannot move', () => {
        const game = createGame()
        let state = pocket(game)
        expect(hydrate(state).canMove(B)).toBe(false)
        state = move(game, state, W, 'F3', 'F4')
        expect(state.machineState).toBe(MachineState.MovingRing)
        expect(state.activePlayerIds).toEqual([W])
    })
})

function legalActions(game: YinshGame, state: YinshGameState): GameAction[] {
    const hydrated = hydrate(state)
    const playerId = state.activePlayerIds[0]
    switch (state.machineState) {
        case MachineState.PlacingRings:
            return POINTS.filter((coords) => hydrated.board.isVacant(coords)).map((coords) =>
                placeAction(game, playerId, coords)
            )
        case MachineState.MovingRing:
            return hydrated.movesFor(playerId).flatMap((ring) =>
                ring.moves.map((m) => ({
                    ...base(game, playerId),
                    type: ActionType.MoveRing,
                    from: ring.from,
                    to: m.to
                }))
            )
        case MachineState.RemovingRow:
            return hydrated.board.rowsOf(playerId).map((row) => ({
                ...base(game, playerId),
                type: ActionType.RemoveRow,
                from: row[0],
                to: row[row.length - 1]
            }))
        case MachineState.RemovingRing:
            return hydrated.board.ringsOf(playerId).map((coords) => ({
                ...base(game, playerId),
                type: ActionType.RemoveRing,
                coords
            }))
        default:
            return []
    }
}

describe('random playouts', () => {
    it.each(
        Object.values(YinshVersion).flatMap((version) =>
            Array.from({ length: 12 }, (_, seed) => [version, seed] as const)
        )
    )('%s seed %i plays to a result', (version, seed) => {
        const game = { ...createGame(version), seed: seed + 1 }
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
            expect(steps).toBeLessThan(1000)
        }
        expect(state.winningPlayerIds.length).toBeGreaterThan(0)
        expect(state.endReason).toBeDefined()
    })
})

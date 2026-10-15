import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    assert,
    defaultGameConfig,
    GameEngine,
    GameResult,
    PlayerStatus,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import { Definition } from './definition.js'
import { ZertzRuntime } from './runtime.js'
import { ZertzInfo } from './info.js'
import { ZertzSetup } from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import {
    EndReason,
    HydratedZertzGameState,
    MarbleSource,
    type ZertzGameState
} from '../model/gameState.js'
import { MarbleColor, noMarbles, type MarbleCounts } from '../model/marbles.js'
import { isPlaceMarble, type PlaceMarble } from '../actions/placeMarble.js'
import { isRemoveRing, type RemoveRing } from '../actions/removeRing.js'
import type { Capture } from '../actions/capture.js'
import type { Ring } from '../model/board.js'

const engine = new GameEngine(ZertzRuntime)

function createGame(setup: ZertzSetup = ZertzSetup.Standard) {
    return ZertzRuntime.initializer.initializeGame(
        {
            id: 'zertz-test',
            typeId: 'zertz',
            ownerId: 'owner',
            seed: 7,
            config: { ...defaultGameConfig(ZertzInfo.configurator?.options ?? []), setup },
            players: ['p0', 'p1'].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

type ZertzGame = ReturnType<typeof createGame>

function start(game: ZertzGame): ZertzGameState {
    return engine.startGame(game, { startingPositions: { playerIds: ['p0', 'p1'] } }).initialState
}

let actionCounter = 0
function userAction(game: ZertzGame) {
    actionCounter += 1
    return { id: `action-${actionCounter}`, gameId: game.id, source: ActionSource.User }
}

function execute(game: ZertzGame, state: ZertzGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action })
}

function place(
    game: ZertzGame,
    state: ZertzGameState,
    playerId: string,
    color: MarbleColor,
    coords: AxialCoordinates
): ZertzGameState {
    const action: PlaceMarble = {
        ...userAction(game),
        type: ActionType.PlaceMarble,
        playerId,
        color,
        coords
    }
    return execute(game, state, action).updatedState
}

function remove(
    game: ZertzGame,
    state: ZertzGameState,
    playerId: string,
    coords: AxialCoordinates
): ZertzGameState {
    const action: RemoveRing = {
        ...userAction(game),
        type: ActionType.RemoveRing,
        playerId,
        coords
    }
    return execute(game, state, action).updatedState
}

function capture(
    game: ZertzGame,
    state: ZertzGameState,
    playerId: string,
    from: AxialCoordinates,
    to: AxialCoordinates
): ZertzGameState {
    const action: Capture = { ...userAction(game), type: ActionType.Capture, playerId, from, to }
    return execute(game, state, action).updatedState
}

function placeMetadata(game: ZertzGame, state: ZertzGameState, action: PlaceMarble) {
    const [processed] = execute(game, state, action).processedActions
    assert(isPlaceMarble(processed))
    return processed.metadata
}

function removeMetadata(game: ZertzGame, state: ZertzGameState, action: RemoveRing) {
    const [processed] = execute(game, state, action).processedActions
    assert(isRemoveRing(processed))
    return processed.metadata
}

function line(length: number, marbles: Record<number, MarbleColor> = {}): Ring[] {
    return Array.from({ length }, (_, q) => {
        const marble = marbles[q]
        return marble === undefined ? { coords: { q, r: 0 } } : { coords: { q, r: 0 }, marble }
    })
}

const MIXED_PETALS = [
    MarbleColor.White,
    MarbleColor.White,
    MarbleColor.Grey,
    MarbleColor.Grey,
    MarbleColor.Black,
    MarbleColor.Black
]

function flower(center: AxialCoordinates): Ring[] {
    const offsets = [
        { q: 0, r: -1 },
        { q: 1, r: -1 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 },
        { q: -1, r: 0 }
    ]
    return [
        { coords: center },
        ...offsets.map((offset, index) => ({
            coords: { q: center.q + offset.q, r: center.r + offset.r },
            marble: MIXED_PETALS[index]
        }))
    ]
}

function withPosition(
    state: ZertzGameState,
    rings: Ring[],
    options: { pool?: MarbleCounts; captured?: Record<string, MarbleCounts> } = {}
): ZertzGameState {
    const next = structuredClone(state)
    next.board.rings = rings
    if (options.pool) {
        next.pool = options.pool
    }
    for (const player of next.players) {
        const captured = options.captured?.[player.playerId]
        if (captured) {
            player.captured = captured
        }
    }
    return next
}

function captured(white: number, grey: number, black: number): MarbleCounts {
    return { [MarbleColor.White]: white, [MarbleColor.Grey]: grey, [MarbleColor.Black]: black }
}

describe('setup', () => {
    it.each([
        [ZertzSetup.Standard, 37, captured(6, 8, 10)],
        [ZertzSetup.Blitz, 37, captured(5, 7, 9)],
        [ZertzSetup.Tournament, 48, captured(6, 8, 10)]
    ])('%s starts with %i rings and its pool', (setup, rings, pool) => {
        const state = start(createGame(setup))
        expect(state.setup).toBe(setup)
        expect(state.board.rings).toHaveLength(rings)
        expect(state.pool).toEqual(pool)
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual(['p0'])
    })

    it('defaults to the standard setup', () => {
        const game = createGame()
        expect(start({ ...game, config: {} }).setup).toBe(ZertzSetup.Standard)
    })
})

describe('placing and removing', () => {
    it('places a pool marble, then removes a free ring, then passes the turn', () => {
        const game = createGame()
        let state = start(game)
        state = place(game, state, 'p0', MarbleColor.White, { q: 0, r: 0 })
        expect(state.machineState).toBe(MachineState.RemovingRing)
        expect(state.activePlayerIds).toEqual(['p0'])
        expect(state.pool[MarbleColor.White]).toBe(5)

        state = remove(game, state, 'p0', { q: 3, r: 0 })
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(state.board.rings).toHaveLength(36)
    })

    it('rejects removing a ring that is not free', () => {
        const game = createGame()
        const state = place(game, start(game), 'p0', MarbleColor.White, { q: 0, r: 0 })
        expect(() => remove(game, state, 'p0', { q: 1, r: 0 })).toThrow()
    })

    it('rejects placing on an occupied ring', () => {
        const game = createGame()
        const state = withPosition(start(game), line(4, { 0: MarbleColor.White }))
        expect(() => place(game, state, 'p0', MarbleColor.Grey, { q: 0, r: 0 })).toThrow()
    })

    it('ends the turn without removal when no ring is free', () => {
        const game = createGame()
        const rings = [...flower({ q: 0, r: 0 }), ...flower({ q: 5, r: 0 })]
        let state = withPosition(start(game), rings)
        expect(new HydratedZertzGameState(state).board.hasAnyJump()).toBe(false)

        state = place(game, state, 'p0', MarbleColor.White, { q: 0, r: 0 })
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(state.board.rings).toHaveLength(7)
        expect(state.players[0].captured).toEqual(captured(3, 2, 2))
    })

    it('places from the player’s own captures once the pool is empty', () => {
        const game = createGame()
        const state = withPosition(start(game), line(5), {
            pool: noMarbles(),
            captured: { p0: captured(0, 1, 0) }
        })
        const action: PlaceMarble = {
            ...userAction(game),
            type: ActionType.PlaceMarble,
            playerId: 'p0',
            color: MarbleColor.Grey,
            coords: { q: 2, r: 0 }
        }
        expect(placeMetadata(game, state, action)).toMatchObject({ source: MarbleSource.Captured })
        const after = execute(game, state, action).updatedState
        expect(after.players[0].captured).toEqual(noMarbles())
    })

    it('rejects a colour the player cannot supply', () => {
        const game = createGame()
        const state = withPosition(start(game), line(5), {
            pool: noMarbles(),
            captured: { p0: captured(0, 1, 0) }
        })
        expect(() => place(game, state, 'p0', MarbleColor.White, { q: 2, r: 0 })).toThrow()
    })
})

describe('captures', () => {
    it('forces a capture instead of a placement', () => {
        const game = createGame()
        const state = withPosition(
            start(game),
            line(4, { 0: MarbleColor.White, 1: MarbleColor.Black })
        )
        expect(engine.getValidActionTypesForPlayer(game, state, 'p0')).toEqual([ActionType.Capture])
        expect(() => place(game, state, 'p0', MarbleColor.Grey, { q: 3, r: 0 })).toThrow()

        const after = capture(game, state, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 })
        expect(after.players[0].captured).toEqual(captured(0, 0, 1))
        expect(after.activePlayerIds).toEqual(['p1'])
        expect(after.machineState).toBe(MachineState.TakingTurn)
    })

    it('requires the same marble to keep jumping', () => {
        const game = createGame()
        let state = withPosition(start(game), [
            ...line(5, { 0: MarbleColor.White, 1: MarbleColor.Grey, 3: MarbleColor.Black }),
            { coords: { q: 1, r: 1 }, marble: MarbleColor.Grey },
            { coords: { q: 1, r: 2 } }
        ])
        state = capture(game, state, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 })
        expect(state.machineState).toBe(MachineState.ContinuingCapture)
        expect(state.activePlayerIds).toEqual(['p0'])
        expect(state.captureChainFrom).toEqual({ q: 2, r: 0 })
        expect(() => capture(game, state, 'p0', { q: 3, r: 0 }, { q: 1, r: 0 })).toThrow()

        state = capture(game, state, 'p0', { q: 2, r: 0 }, { q: 4, r: 0 })
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(state.captureChainFrom).toBeUndefined()
        expect(state.players[0].captured).toEqual(captured(0, 1, 1))
    })
})

describe('isolated groups', () => {
    it('claims a group cut off by a ring removal', () => {
        const game = createGame()
        let state = withPosition(start(game), line(5, { 0: MarbleColor.White }))
        state = place(game, state, 'p0', MarbleColor.Grey, { q: 4, r: 0 })
        const action: RemoveRing = {
            ...userAction(game),
            type: ActionType.RemoveRing,
            playerId: 'p0',
            coords: { q: 1, r: 0 }
        }
        expect(removeMetadata(game, state, action)).toEqual({
            claimedRings: [{ coords: { q: 0, r: 0 }, marble: MarbleColor.White }]
        })
        state = execute(game, state, action).updatedState
        expect(state.players[0].captured).toEqual(captured(1, 0, 0))
        expect(state.board.rings).toHaveLength(3)
    })

    it('claims a group filled by a placement, then still removes a ring', () => {
        const game = createGame()
        let state = withPosition(start(game), [...line(4), { coords: { q: 0, r: 2 } }])
        state = place(game, state, 'p0', MarbleColor.Black, { q: 0, r: 2 })
        expect(state.players[0].captured).toEqual(captured(0, 0, 1))
        expect(state.board.rings).toHaveLength(4)
        expect(state.machineState).toBe(MachineState.RemovingRing)
    })

    it('does not claim a cut-off group that still has a vacant ring', () => {
        const game = createGame()
        let state = withPosition(start(game), line(6, { 0: MarbleColor.White }))
        state = place(game, state, 'p0', MarbleColor.Grey, { q: 5, r: 0 })
        state = remove(game, state, 'p0', { q: 2, r: 0 })
        expect(state.players[0].captured).toEqual(noMarbles())
        expect(state.board.rings).toHaveLength(5)
    })
})

describe('end of game', () => {
    it('wins with three marbles of each colour', () => {
        const game = createGame()
        const state = withPosition(
            start(game),
            line(4, { 0: MarbleColor.White, 1: MarbleColor.Black }),
            { captured: { p0: captured(3, 3, 2) } }
        )
        const after = capture(game, state, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 })
        expect(after.machineState).toBe(MachineState.EndOfGame)
        expect(after.result).toBe(GameResult.Win)
        expect(after.winningPlayerIds).toEqual(['p0'])
        expect(after.endReason).toBe(EndReason.Captures)
        expect(after.activePlayerIds).toEqual([])
    })

    it.each([
        [ZertzSetup.Standard, captured(3, 0, 0), true],
        [ZertzSetup.Standard, captured(2, 0, 0), false],
        [ZertzSetup.Blitz, captured(2, 0, 0), true],
        [ZertzSetup.Tournament, captured(3, 0, 0), true]
    ])('%s: capturing a white with %o already captured wins: %s', (setup, before, wins) => {
        const game = createGame(setup)
        const state = withPosition(
            start(game),
            line(4, { 0: MarbleColor.Black, 1: MarbleColor.White }),
            { captured: { p0: before } }
        )
        const after = capture(game, state, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 })
        expect(after.machineState === MachineState.EndOfGame).toBe(wins)
    })

    it('the player who fills the board wins', () => {
        const game = createGame()
        let state = withPosition(start(game), flower({ q: 0, r: 0 }))
        state = place(game, state, 'p0', MarbleColor.White, { q: 0, r: 0 })
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual(['p0'])
        expect(state.endReason).toBe(EndReason.FullBoard)
        expect(state.board.rings).toHaveLength(0)
    })

    it('a player who cannot place or capture loses', () => {
        const game = createGame()
        let state = withPosition(start(game), line(5), { pool: captured(1, 0, 0) })
        state = place(game, state, 'p0', MarbleColor.White, { q: 2, r: 0 })
        state = remove(game, state, 'p0', { q: 0, r: 0 })
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual(['p0'])
        expect(state.endReason).toBe(EndReason.NoMarbles)
    })
})

function legalActions(game: ZertzGame, state: ZertzGameState): GameAction[] {
    const hydrated = new HydratedZertzGameState(state)
    const playerId = state.activePlayerIds[0]
    const base = () => ({ ...userAction(game), playerId })
    const { board } = hydrated
    switch (state.machineState) {
        case MachineState.RemovingRing:
            return board
                .freeRings()
                .map((ring) => ({ ...base(), type: ActionType.RemoveRing, coords: ring.coords }))
        case MachineState.ContinuingCapture:
        case MachineState.TakingTurn: {
            const chainFrom = hydrated.captureChainFrom
            const jumps = chainFrom ? board.jumpsFrom(chainFrom) : board.allJumps()
            if (jumps.length > 0) {
                return jumps.map((jump) => ({
                    ...base(),
                    type: ActionType.Capture,
                    from: jump.from,
                    to: jump.to
                }))
            }
            return hydrated.placeableColors(playerId).flatMap((color) =>
                board.vacantRings().map((ring) => ({
                    ...base(),
                    type: ActionType.PlaceMarble,
                    color,
                    coords: ring.coords
                }))
            )
        }
        default:
            return []
    }
}

describe('random playouts', () => {
    it.each(
        Object.values(ZertzSetup).flatMap((setup) =>
            Array.from({ length: 15 }, (_, seed) => [setup, seed] as const)
        )
    )('%s seed %i plays to a single winner', (setup, seed) => {
        const game = createGame(setup)
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
            state = execute(game, state, choose(actions)).updatedState
            steps += 1
            expect(steps).toBeLessThan(300)
        }
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toHaveLength(1)
        expect(state.endReason).toBeDefined()
    })
})

import { describe, expect, it } from 'vitest'
import { assert, GameResult, type AxialCoordinates, type GameAction } from '@tabletop/common'
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
import type { Capture } from '../actions/capture.js'
import type { Ring } from '../model/board.js'
import {
    actionBase,
    createGame,
    engine,
    execute,
    playToEnd,
    type ZertzGame
} from './tests/playthrough.js'

function start(game: ZertzGame): ZertzGameState {
    return engine.startGame(game, { startingPositions: { playerIds: ['p0', 'p1'] } }).initialState
}

function run(game: ZertzGame, state: ZertzGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action })
}

function place(
    game: ZertzGame,
    state: ZertzGameState,
    playerId: string,
    color: MarbleColor,
    coords: AxialCoordinates,
    remove?: AxialCoordinates
): ZertzGameState {
    return execute(game, state, placing(game, playerId, color, coords, remove))
}

function placing(
    game: ZertzGame,
    playerId: string,
    color: MarbleColor,
    coords: AxialCoordinates,
    remove?: AxialCoordinates
): PlaceMarble {
    return {
        ...actionBase(game, playerId),
        type: ActionType.PlaceMarble,
        color,
        coords,
        ...(remove === undefined ? {} : { remove })
    }
}

function capture(
    game: ZertzGame,
    state: ZertzGameState,
    playerId: string,
    from: AxialCoordinates,
    to: AxialCoordinates
): ZertzGameState {
    const action: Capture = { ...actionBase(game, playerId), type: ActionType.Capture, from, to }
    return execute(game, state, action)
}

function placeMetadata(game: ZertzGame, state: ZertzGameState, action: PlaceMarble) {
    const [processed] = run(game, state, action).processedActions
    assert(isPlaceMarble(processed))
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
    it('places a pool marble and removes a free ring in one move, then passes the turn', () => {
        const game = createGame()
        const state = place(
            game,
            start(game),
            'p0',
            MarbleColor.White,
            { q: 0, r: 0 },
            { q: 3, r: 0 }
        )
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(state.pool[MarbleColor.White]).toBe(5)
        expect(state.board.rings).toHaveLength(36)
    })

    it('rejects removing a ring that is not free', () => {
        const game = createGame()
        expect(() =>
            place(game, start(game), 'p0', MarbleColor.White, { q: 0, r: 0 }, { q: 1, r: 0 })
        ).toThrow()
    })

    it('rejects removing the ring just placed on', () => {
        const game = createGame()
        expect(() =>
            place(game, start(game), 'p0', MarbleColor.White, { q: 3, r: 0 }, { q: 3, r: 0 })
        ).toThrow()
    })

    it('requires a removal while a ring is free', () => {
        const game = createGame()
        expect(() => place(game, start(game), 'p0', MarbleColor.White, { q: 0, r: 0 })).toThrow()
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

    it('rejects a removal when no ring is free', () => {
        const game = createGame()
        const rings = [...flower({ q: 0, r: 0 }), ...flower({ q: 5, r: 0 })]
        const state = withPosition(start(game), rings)
        expect(() =>
            place(game, state, 'p0', MarbleColor.White, { q: 0, r: 0 }, { q: 5, r: 0 })
        ).toThrow()
    })

    it('places from the player’s own captures once the pool is empty', () => {
        const game = createGame()
        const state = withPosition(start(game), line(5), {
            pool: noMarbles(),
            captured: { p0: captured(0, 1, 0) }
        })
        const action: PlaceMarble = {
            ...actionBase(game, 'p0'),
            type: ActionType.PlaceMarble,
            color: MarbleColor.Grey,
            coords: { q: 2, r: 0 },
            remove: { q: 0, r: 0 }
        }
        expect(placeMetadata(game, state, action)).toMatchObject({ source: MarbleSource.Captured })
        const after = execute(game, state, action)
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

    it('lets the player choose a capture that takes fewer marbles', () => {
        const game = createGame()
        const state = withPosition(start(game), [
            ...line(5, { 0: MarbleColor.White, 1: MarbleColor.Grey, 3: MarbleColor.Black }),
            { coords: { q: 1, r: 1 }, marble: MarbleColor.Grey },
            { coords: { q: 1, r: 2 } }
        ])
        const after = capture(game, state, 'p0', { q: 1, r: 0 }, { q: 1, r: 2 })
        expect(after.players[0].captured).toEqual(captured(0, 1, 0))
        expect(after.activePlayerIds).toEqual(['p1'])
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
        const action = placing(game, 'p0', MarbleColor.Grey, { q: 4, r: 0 }, { q: 1, r: 0 })
        expect(placeMetadata(game, state, action)).toEqual({
            source: MarbleSource.Pool,
            claimedOnPlacing: [],
            claimedOnRemoving: [{ coords: { q: 0, r: 0 }, marble: MarbleColor.White }]
        })
        state = execute(game, state, action)
        expect(state.players[0].captured).toEqual(captured(1, 0, 0))
        expect(state.board.rings).toHaveLength(3)
    })

    it('claims a group filled by a placement, then still removes a ring', () => {
        const game = createGame()
        const before = withPosition(start(game), [...line(4), { coords: { q: 0, r: 2 } }])
        expect(() => place(game, before, 'p0', MarbleColor.Black, { q: 0, r: 2 })).toThrow()
        const action = placing(game, 'p0', MarbleColor.Black, { q: 0, r: 2 }, { q: 3, r: 0 })
        expect(placeMetadata(game, before, action)).toEqual({
            source: MarbleSource.Pool,
            claimedOnPlacing: [{ coords: { q: 0, r: 2 }, marble: MarbleColor.Black }],
            claimedOnRemoving: []
        })
        const state = execute(game, before, action)
        expect(state.players[0].captured).toEqual(captured(0, 0, 1))
        expect(state.board.rings).toHaveLength(3)
        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('does not claim a cut-off group that still has a vacant ring', () => {
        const game = createGame()
        let state = withPosition(start(game), line(6, { 0: MarbleColor.White }))
        state = place(game, state, 'p0', MarbleColor.Grey, { q: 5, r: 0 }, { q: 2, r: 0 })
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

    it.each([
        [MarbleColor.White, captured(3, 0, 0)],
        [MarbleColor.Grey, captured(0, 4, 0)],
        [MarbleColor.Black, captured(0, 0, 5)]
    ])('wins with enough of one colour: %s', (color, before) => {
        const game = createGame()
        const state = withPosition(start(game), line(4, { 0: MarbleColor.White, 1: color }), {
            captured: { p0: before }
        })
        const after = capture(game, state, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 })
        expect(after.machineState).toBe(MachineState.EndOfGame)
        expect(after.endReason).toBe(EndReason.Captures)
    })

    it.each([
        [MarbleColor.Grey, captured(0, 3, 0)],
        [MarbleColor.Black, captured(0, 0, 4)],
        [MarbleColor.Black, captured(2, 2, 1)]
    ])('Blitz: capturing a %s with %o already captured wins', (color, before) => {
        const game = createGame(ZertzSetup.Blitz)
        const state = withPosition(start(game), line(4, { 0: MarbleColor.White, 1: color }), {
            captured: { p0: before }
        })
        const after = capture(game, state, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 })
        expect(after.machineState).toBe(MachineState.EndOfGame)
        expect(after.endReason).toBe(EndReason.Captures)
    })

    it('counts claimed marbles towards a win', () => {
        const game = createGame()
        const state = withPosition(start(game), line(5, { 0: MarbleColor.White }), {
            captured: { p0: captured(2, 3, 3) }
        })
        const after = place(game, state, 'p0', MarbleColor.Grey, { q: 4, r: 0 }, { q: 1, r: 0 })
        expect(after.machineState).toBe(MachineState.EndOfGame)
        expect(after.winningPlayerIds).toEqual(['p0'])
        expect(after.endReason).toBe(EndReason.Captures)
    })

    it('a placement that wins by claiming ends the move without a removal', () => {
        const game = createGame()
        const state = withPosition(start(game), [...line(4), { coords: { q: 0, r: 2 } }], {
            captured: { p0: captured(0, 0, 5) }
        })
        expect(() =>
            place(game, state, 'p0', MarbleColor.Black, { q: 0, r: 2 }, { q: 3, r: 0 })
        ).toThrow()
        const after = place(game, state, 'p0', MarbleColor.Black, { q: 0, r: 2 })
        expect(after.machineState).toBe(MachineState.EndOfGame)
        expect(after.endReason).toBe(EndReason.Captures)
        expect(after.board.rings).toHaveLength(4)
    })

    it('a chain ends with the jump that wins', () => {
        const game = createGame()
        const state = withPosition(
            start(game),
            line(5, { 0: MarbleColor.White, 1: MarbleColor.Grey, 3: MarbleColor.Black }),
            { captured: { p0: captured(0, 4, 0) } }
        )
        const after = capture(game, state, 'p0', { q: 0, r: 0 }, { q: 2, r: 0 })
        expect(after.machineState).toBe(MachineState.EndOfGame)
        expect(after.captureChainFrom).toBeUndefined()
        expect(after.board.rings.find((ring) => ring.coords.q === 3)?.marble).toBe(
            MarbleColor.Black
        )
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
        state = place(game, state, 'p0', MarbleColor.White, { q: 2, r: 0 }, { q: 0, r: 0 })
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual(['p0'])
        expect(state.endReason).toBe(EndReason.NoMarbles)
    })
})

describe('random playouts', () => {
    it.each(
        Object.values(ZertzSetup).flatMap((setup) =>
            Array.from({ length: 15 }, (_, seed) => [setup, seed] as const)
        )
    )('%s seed %i plays to a single winner', (setup, seed) => {
        const game = createGame(setup)
        const state = playToEnd(game, start(game), seed)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toHaveLength(1)
        expect(state.endReason).toBeDefined()
    })
})

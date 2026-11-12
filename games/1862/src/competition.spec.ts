import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    validateGameResult,
    type GameConfig
} from '@tabletop/common'
import { playOut } from '../test/bot.js'
import { table } from '../test/kit.js'
import { Definition } from './definition/gameDefinition.js'
import { parliamentDecision } from './parliament.js'
import type { State1862 } from './state.js'

const masterSeed = '00000000000000000000000000001862'
const PlayerCounts = [2, 3, 4, 5, 6, 7, 8] as const
// The options that change setup: the trains the depot holds, and the station limit (§2.4.3, §11.4).
const SetupConfigs: readonly GameConfig[] = [
    {},
    { length: 'short' },
    { length: 'long' },
    { eightStations: true }
]

const engine = new GameEngine(Definition.runtime)

function createGame(count: number, config: GameConfig) {
    return Definition.runtime.initializer.initializeGame(
        {
            id: 'starting-positions',
            typeId: Definition.info.id,
            ownerId: 'p0',
            config,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `p${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function start(count: number, config: GameConfig, playerIds?: readonly string[]) {
    const game = createGame(count, config)
    const started = engine.startGame(game, {
        masterSeed,
        ...(playerIds ? { startingPositions: { playerIds: [...playerIds] } } : {})
    })
    return { game: started.startedGame, state: started.initialState }
}

function withoutId({ id: _id, ...state }: State1862) {
    return state
}

/** The ordinary setup as the assigned seating should leave it: only the order and opener move. */
function seated(ordinary: State1862, playerIds: readonly string[]) {
    const [seatOne] = playerIds
    return {
        ...withoutId(ordinary),
        activePlayerIds: [seatOne],
        turnManager: {
            ...ordinary.turnManager,
            turnOrder: [...playerIds],
            series: [{ type: 'turn', playerId: seatOne, start: 0 }]
        }
    }
}

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

/** Who opens in turn as every player declines the first Parliament Round (§4.1). */
function openersOfFirstParliament(count: number, config: GameConfig, seats: string[]) {
    const { game, state: initial } = start(count, config, seats)
    let state = initial
    const openers: string[] = []
    while (state.machineState === 'ParliamentRound' && state.parliament?.number === 1) {
        const [playerId] = state.activePlayerIds
        assertExists(playerId, 'A player opens')
        openers.push(playerId)
        state = engine.executeCanonicalAction({
            game,
            state,
            action: {
                id: `decline:${openers.length}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                type: 'DeclineCharter'
            }
        }).updatedState
    }
    return openers
}

describe.each(SetupConfigs.flatMap((config) => PlayerCounts.map((count) => ({ count, config }))))(
    '1862 assigned starting positions with $count players and config $config',
    ({ count, config }) => {
        const ordinary = start(count, config).state

        it('reproduces an ordinary game from its master seed', () => {
            expect(withoutId(start(count, config).state)).toEqual(withoutId(ordinary))
            expect(ordinary.masterSeed).toBe(masterSeed)
            expect(ordinary.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        })

        it('reproduces the ordinary setup when assigned its seating', () => {
            expect(withoutId(start(count, config, ordinary.turnManager.turnOrder).state)).toEqual(
                withoutId(ordinary)
            )
        })

        it.each(
            [
                ...rotations(ordinary.turnManager.turnOrder),
                [...ordinary.turnManager.turnOrder].reverse()
            ].map((playerIds) => ({ playerIds }))
        )('seats $playerIds with the first seat opening Parliament', ({ playerIds }) => {
            const assigned = start(count, config, playerIds).state
            expect(withoutId(assigned)).toEqual(seated(ordinary, playerIds))
            expect(assigned.machineState).toBe('ParliamentRound')
            expect(assigned.activePlayerIds).toEqual([playerIds[0]])
            expect(parliamentDecision(assigned)).toEqual({ kind: 'open', playerId: playerIds[0] })
        })

        it('passes the opening around the table in seat order', () => {
            const seats = [...ordinary.turnManager.turnOrder].reverse()
            expect(openersOfFirstParliament(count, config, seats)).toEqual(seats)
        })
    }
)

describe('1862 setup options', () => {
    const remaining = (state: State1862) =>
        state.trainInventory.trains.filter((train) => train.status === 'depot').length

    it('changes the depot with the game length and nothing else of the deal', () => {
        const standard = start(4, {}).state
        const short = start(4, { length: 'short' }).state
        const long = start(4, { length: 'long' }).state
        expect(remaining(short)).toBeLessThan(remaining(standard))
        expect(remaining(long)).toBeGreaterThan(remaining(standard))
        for (const other of [short, long]) {
            expect(other.availability).toEqual(standard.availability)
            expect(other.originalPermits).toEqual(standard.originalPermits)
            expect(other.turnManager.turnOrder).toEqual(standard.turnManager.turnOrder)
        }
    })

    it('records eight stations as a variant', () => {
        expect(start(4, {}).state.variants).toEqual({})
        expect(start(4, { eightStations: true }).state.variants).toEqual({ eightStations: true })
    })
})

describe('1862 competition setup', () => {
    it.each(PlayerCounts.map((count) => ({ count })))(
        'starts a $count-player game with a colour for each player',
        ({ count }) => {
            const colors = start(count, {}).state.players.map((player) => player.color)
            expect(new Set(colors).size).toBe(count)
            expect(colors.every(Boolean)).toBe(true)
        }
    )

    it('rejects an assignment that does not seat every player once', () => {
        const game = createGame(3, {})
        expect(() =>
            Definition.runtime.initializer.initializeGameState(
                game,
                engine.generateUninitializedState(game, masterSeed),
                { playerIds: ['p1', 'p2', 'stranger'] }
            )
        ).toThrow('Starting positions must assign every player exactly once')
    })
})

function expectRankedResult(state: State1862) {
    expect(state.machineState).toBe('GameOver')
    expect(() => validateGameResult(state)).not.toThrow()
    const scoring = Definition.runtime.scoring
    assertExists(scoring, '1862 declares final scores')
    const scores = scoring.finalScores(state)
    const highest = Math.max(...Object.values(scores))
    expect(
        Object.keys(scores)
            .filter((playerId) => scores[playerId] === highest)
            .sort()
    ).toEqual([...(state.winningPlayerIds ?? [])].sort())
}

describe('1862 competition results', () => {
    it(
        'finishes a game from assigned seats with a valid result ranked by final scores',
        { timeout: 600_000 },
        () => {
            const seed = 12
            const game = table(2, seed, undefined, (playerIds) => [...playerIds].reverse())
            expect(game.state.turnManager.turnOrder).toEqual(['p2', 'p1'])
            playOut(game, seed, 6000)
            expectRankedResult(game.state)
        }
    )
})

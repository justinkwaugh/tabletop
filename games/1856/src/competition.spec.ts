import { describe, expect, it } from 'vitest'
import {
    GameEngine,
    PlayerStatus,
    assertExists,
    validateGameResult,
    type GameConfig
} from '@tabletop/common'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { Definition } from './definition/gameDefinition.js'
import type { State1856 } from './state.js'

const masterSeed = '00000000000000000000000000001856'
const PlayerCounts = [3, 4, 5, 6] as const
// The options that change setup: the 8-train supply, and the destinations (Variants).
const SetupConfigs: readonly GameConfig[] = [
    {},
    { eightTrains: true },
    { alternateDestinations: true }
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
    const started = engine.startGame(createGame(count, config), {
        masterSeed,
        ...(playerIds ? { startingPositions: { playerIds: [...playerIds] } } : {})
    })
    return started.initialState
}

function withoutId({ id: _id, ...state }: State1856) {
    return state
}

/** The ordinary setup as the assigned seating should leave it: only the order and who bids first move. */
function seated(ordinary: State1856, playerIds: readonly string[]) {
    const [seatOne] = playerIds
    const auction = ordinary.openingAuction
    return {
        ...withoutId(ordinary),
        activePlayerIds: [seatOne],
        turnManager: {
            ...ordinary.turnManager,
            turnOrder: [...playerIds],
            series: [{ type: 'turn', playerId: seatOne, start: 0 }]
        },
        ...(auction ? { openingAuction: { ...auction, nextPlayerId: seatOne } } : {})
    }
}

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

describe.each(SetupConfigs.flatMap((config) => PlayerCounts.map((count) => ({ config, count }))))(
    '1856 assigned starting positions with $count players, options $config',
    ({ config, count }) => {
        const ordinary = start(count, config)

        it('reproduces an ordinary game from its master seed', () => {
            expect(withoutId(start(count, config))).toEqual(withoutId(ordinary))
            expect(ordinary.masterSeed).toBe(masterSeed)
            expect(ordinary.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        })

        it.each(
            [
                ...rotations(ordinary.turnManager.turnOrder),
                [...ordinary.turnManager.turnOrder].reverse()
            ].map((playerIds) => ({ playerIds }))
        )('seats $playerIds with the first seat opening the private auction', ({ playerIds }) => {
            const assigned = start(count, config, playerIds)
            expect(withoutId(assigned)).toEqual(seated(ordinary, playerIds))
            expect(assigned.machineState).toBe('WaterfallAuction')
            expect(assigned.activePlayerIds).toEqual([playerIds[0]])
            expect(assigned.openingAuction?.nextPlayerId).toBe(playerIds[0])
        })
    }
)

describe('1856 competition setup', () => {
    it.each(PlayerCounts.map((count) => ({ count })))(
        'starts a $count-player game with a colour for each player',
        ({ count }) => {
            const colors = start(count, {}).players.map((player) => player.color)
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
                { playerIds: ['p0', 'p1', 'stranger'] }
            )
        ).toThrow('Starting positions must assign every player exactly once')
    })
})

describe('1856 competition results', () => {
    it(
        'finishes a game from assigned seats with a valid result ranked by final scores',
        {
            timeout: 600_000
        },
        () => {
            const seed = 1
            const game = kit.table(4, seed, {}, (playerIds) => [...playerIds].reverse())
            expect(game.state.turnManager.turnOrder).toEqual(['p4', 'p3', 'p2', 'p1'])
            playOut(game, seed)
            const state = game.state
            expect(state.machineState).toBe('GameOver')
            expect(() => validateGameResult(state)).not.toThrow()
            const scoring = Definition.runtime.scoring
            assertExists(scoring, '1856 declares final scores')
            const scores = scoring.finalScores(state)
            const highest = Math.max(...Object.values(scores))
            expect(
                Object.keys(scores)
                    .filter((playerId) => scores[playerId] === highest)
                    .sort()
            ).toEqual([...(state.winningPlayerIds ?? [])].sort())
        }
    )
})

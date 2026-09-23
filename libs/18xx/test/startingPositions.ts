import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus, type GameDefinition } from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import type { ScenarioDefinition } from '@tabletop/18xx/scenarios'

const masterSeed = '0123456789abcdef0123456789abcdef'

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

export function startingPositionTests(
    definition: GameDefinition<EighteenXXState, HydratedEighteenXXState>,
    scenarios: ScenarioDefinition,
    playerCounts: readonly number[]
) {
    const engine = new GameEngine(definition.runtime)
    const createGame = (count: number, gameDefinition = definition, config = {}) =>
        gameDefinition.runtime.initializer.initializeGame(
            {
                id: 'starting-positions',
                typeId: gameDefinition.info.id,
                ownerId: 'p0',
                config,
                players: Array.from({ length: count }, (_, index) => ({
                    id: `p${index}`,
                    name: `p${index}`,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            gameDefinition
        )
    const start = (count: number, playerIds?: string[]) => {
        const { id, ...state } = engine.startGame(createGame(count), {
            masterSeed,
            ...(playerIds ? { startingPositions: { playerIds } } : {})
        }).initialState
        return state
    }

    describe.each(playerCounts)('assigned starting positions with %i players', (count) => {
        const ordinary = start(count)

        it('reproduces an ordinary game from its master seed', () => {
            expect(start(count)).toEqual(ordinary)
            expect(ordinary.masterSeed).toBe(masterSeed)
            expect(ordinary.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        })

        it('reproduces the ordinary setup when assigned its seating', () => {
            expect(start(count, ordinary.turnManager.turnOrder)).toEqual(ordinary)
        })

        it.each(
            [
                ...rotations(ordinary.turnManager.turnOrder),
                [...ordinary.turnManager.turnOrder].reverse()
            ].map((playerIds) => ({ playerIds }))
        )('seats $playerIds and starts with the first position', ({ playerIds }) => {
            const assigned = start(count, playerIds)
            expect(assigned.turnManager.turnOrder).toEqual(playerIds)
            expect(assigned.activePlayerIds).toEqual([playerIds[0]])
            expect(assigned.turnManager.series).toEqual([
                { type: 'turn', playerId: playerIds[0], start: 0 }
            ])
            expect(assigned.prng).toEqual(ordinary.prng)
            expect(assigned.players).toEqual(ordinary.players)
        })
    })

    it('rejects an assignment that does not seat every player once', () => {
        const count = playerCounts[0]
        const playerIds = Array.from({ length: count }, (_, index) => `p${index}`)
        expect(() =>
            definition.runtime.initializer.initializeGameState(
                createGame(count),
                engine.generateUninitializedState(createGame(count), masterSeed),
                { playerIds: [...playerIds.slice(1), 'stranger'] }
            )
        ).toThrow('Starting positions must assign every player exactly once')
    })

    it('rejects assigned starting positions for a prepared scenario', () => {
        const game = createGame(3, scenarios, { examplePosition: 'trading' })
        expect(() =>
            new GameEngine(scenarios.runtime).startGame(game, {
                masterSeed,
                startingPositions: { playerIds: ['p2', 'p0', 'p1'] }
            })
        ).toThrow('Prepared scenarios do not support assigned starting positions')
    })
}

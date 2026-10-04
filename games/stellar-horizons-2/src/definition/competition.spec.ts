import { describe, expect, it } from 'vitest'
import { Faction } from '../components/factions.js'
import { StellarHorizonsGameStateValidator } from '../model/gameState.js'
import { MASTER_SEED, createGame, engine, execute, userAction } from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { StellarHorizonsRuntime } from './runtime.js'

function rotations(ids: string[]): string[][] {
    return ids.map((_, offset) => [...ids.slice(offset), ...ids.slice(0, offset)])
}

describe.each([2, 3, 4])('Stellar Horizons tournaments with %i players', (count) => {
    it('gives the first faction choice and initiative to seat one', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState, startedGame } = engine.startGame(game, {
                masterSeed: MASTER_SEED,
                startingPositions: { playerIds: order }
            })
            expect(startedGame.protectedInformation).toBe(true)
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.activePlayerIds).toEqual([order[0]])
            const chosen = execute(
                game,
                initialState,
                userAction(game, order[0], ActionType.ChooseFaction, {
                    faction: Faction.Starfarers
                })
            )
            expect(chosen.activePlayerIds).toEqual([order[1]])
        }
    })

    it('keeps the seeded setup apart from who sits where', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game, MASTER_SEED)
        const initialize = (playerIds?: string[]) =>
            StellarHorizonsRuntime.initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const normal = initialize()
        for (const order of rotations(game.players.map((player) => player.id))) {
            const assigned = initialize(order)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(assigned.systems).toEqual(normal.systems)
            expect(assigned.worldPool).toEqual(normal.worldPool)
        }
    })
})

describe.each([1, 2, 3, 4])('Stellar Horizons visibility with %i players', (count) => {
    it('hides the seeds from every player while keeping the table public', () => {
        const game = createGame(count)
        const { initialState } = engine.startGame(game, { masterSeed: MASTER_SEED })
        if (!StellarHorizonsGameStateValidator.Check(initialState)) {
            throw new Error('Expected complete canonical state')
        }
        for (const perspective of [
            { kind: 'spectator' } as const,
            ...game.players.map((player) => ({ kind: 'player', playerId: player.id }) as const)
        ]) {
            const view = StellarHorizonsRuntime.visibility.state.project(
                initialState,
                perspective,
                {
                    config: game.config
                }
            )
            expect(view).not.toHaveProperty('masterSeed')
            expect(view.players).toEqual(initialState.players)
            expect(view.techPools).toEqual(initialState.techPools)
            expect(() => StellarHorizonsRuntime.hydrator.hydrateState(view)).not.toThrow()
        }
    })
})

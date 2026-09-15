import {
    ActionSource,
    assert,
    GameEngine,
    GameResult,
    MachineContext,
    PlayerStatus,
    validateGameResult
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { PlaceBid } from '../actions/placeBid.js'
import { KaivaiGameStateValidator } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { Ruleset, type KaivaiGameConfig } from './gameConfig.js'
import { Definition } from './gameDefinition.js'
import { KaivaiRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(KaivaiRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number, config: KaivaiGameConfig) {
    return KaivaiRuntime.initializer.initializeGame(
        {
            id: 'kaivai-competition',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

describe.each([3, 4])('Kaivai tournaments with %i players', (count) => {
    describe.each(Object.values(Ruleset))('%s', (ruleset) => {
        it('honors assigned seats through opening bids, then uses bid order for huts', () => {
            const game = createGame(count, { ruleset, lucklessFishing: false })
            const playerIds = game.players.map((player) => player.id)
            for (let offset = 0; offset < count; offset++) {
                const order = [...playerIds.slice(offset), ...playerIds.slice(0, offset)]
                const { initialState, startedGame } = engine.startGame(game, {
                    masterSeed,
                    startingPositions: { playerIds: order }
                })
                let state = initialState
                expect(state.turnManager.turnOrder).toEqual(order)
                expect(startedGame.protectedInformation).toBe(true)
                for (const [index, playerId] of order.entries()) {
                    expect(state.activePlayerIds).toEqual([playerId])
                    const action: PlaceBid = {
                        id: `bid-${playerId}`,
                        gameId: game.id,
                        source: ActionSource.User,
                        type: ActionType.PlaceBid,
                        playerId,
                        amount: index + 1
                    }
                    state = engine.executeCanonicalAction({
                        game: startedGame,
                        state,
                        action
                    }).updatedState
                }
                expect(state.machineState).toBe(MachineState.InitialHuts)
                expect(state.turnManager.turnOrder).toEqual(order.toReversed())
                expect(state.activePlayerIds).toEqual([order.at(-1)])
            }
        })

        it.each([
            { lucklessFishing: false, lessluckFishing: false },
            { lucklessFishing: true, lessluckFishing: false },
            { lucklessFishing: false, lessluckFishing: true }
        ])('preserves seeded setup and visibility with %o', (fishing) => {
            const game = createGame(count, { ruleset, ...fishing })
            const uninitialized = engine.generateUninitializedState(game, masterSeed)
            const initialize = (playerIds?: string[]) =>
                KaivaiRuntime.initializer
                    .initializeGameState(
                        game,
                        structuredClone(uninitialized),
                        playerIds ? { playerIds } : undefined
                    )
                    .dehydrate()
            const normal = initialize()
            expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
            const order = normal.turnManager.turnOrder.toReversed()
            const assigned = initialize(order)
            expect(initialize(order)).toEqual(assigned)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
            assert(KaivaiGameStateValidator.Check(assigned), 'Expected complete canonical state')
            for (const perspective of [
                ...order.map((playerId) => ({ kind: 'player', playerId }) as const),
                { kind: 'spectator' } as const
            ]) {
                const projected = KaivaiRuntime.visibility.state.project(assigned, perspective)
                expect(projected.turnManager.turnOrder).toEqual(order)
                expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            }
        })

        it('records a terminal winner accepted by tournament scoring', () => {
            const game = createGame(count, { ruleset, lucklessFishing: false })
            const state = KaivaiRuntime.hydrator.hydrateState(
                engine.startGame(game, {
                    masterSeed,
                    startingPositions: {
                        playerIds: game.players.map((player) => player.id).reverse()
                    }
                }).initialState
            )
            state.getPlayerState('p0').score = 10
            state.machineState = MachineState.EndOfGame
            KaivaiRuntime.stateHandlers[MachineState.EndOfGame].enter(
                new MachineContext({ gameState: state, gameConfig: game.config })
            )
            expect(state.result).toBe(GameResult.Win)
            expect(state.winningPlayerIds).toEqual(['p0'])
            expect(() => validateGameResult(state)).not.toThrow()
        })
    })
})

import {
    ActionSource,
    assertExists,
    GameEngine,
    GameResult,
    MachineContext,
    PlayerStatus,
    validateGameResult
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { HydratedPlaceCity, type PlaceCity } from '../actions/placeCity.js'
import { resolvePostOperationsState } from '../stateHandlers/operationsFlow.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { Era } from './eras.js'
import { IndonesiaInfo } from './info.js'
import { IndonesiaRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(IndonesiaRuntime)

function createGame(count: number) {
    return IndonesiaRuntime.initializer.initializeGame(
        {
            id: 'indonesia-competition',
            typeId: IndonesiaInfo.id,
            ownerId: 'owner',
            seed: 101,
            config: {},
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

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

describe.each([3, 4, 5])('Indonesia tournaments with %i players', (count) => {
    it('declares support for assigned starting positions', () => {
        expect(IndonesiaRuntime.initializer.supportsStartingPositions).toBe(true)
    })

    it('honors every starting seat through the first round of city placements', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState } = engine.startGame(game, {
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.players.map((player) => player.playerId)).toEqual(order)
            expect(initialState.machineState).toBe(MachineState.NewEra)
            expect(initialState.placingCities).toEqual(order)
            expect(initialState.turnManager.series[0].playerId).toBe(order[0])

            let state = initialState
            while (state.machineState === MachineState.NewEra) {
                const [playerId] = state.activePlayerIds
                assertExists(playerId, 'Expected an active player placing a city')
                const hydrated = IndonesiaRuntime.hydrator.hydrateState(state)
                const [areaId] = HydratedPlaceCity.validAreaIds(hydrated, playerId)
                assertExists(areaId, `Expected a city placement for ${playerId}`)
                const action: PlaceCity = {
                    id: `city-${playerId}`,
                    gameId: game.id,
                    source: ActionSource.User,
                    type: ActionType.PlaceCity,
                    playerId,
                    areaId
                }
                state = engine.executeCanonicalAction({ game, state, action }).updatedState
            }
            expect(state.turnManager.series.slice(0, count).map((turn) => turn.playerId)).toEqual(
                order
            )
        }
    })

    it('preserves ordinary seeded setup, colors and city cards', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game)
        const initialize = (playerIds?: string[]) =>
            IndonesiaRuntime.initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const byPlayer = (players: { playerId: string }[]) =>
            players.toSorted((a, b) => a.playerId.localeCompare(b.playerId))

        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)

        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(order)
            expect(initialize(order)).toEqual(assigned)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(assigned.players.map((player) => player.playerId)).toEqual(order)
            expect(byPlayer(assigned.players)).toEqual(byPlayer(normal.players))
            expect({
                ...assigned,
                players: normal.players,
                turnManager: normal.turnManager
            }).toEqual(normal)
        }
    })

    it.each([false, true])(
        'records the terminal winner and final scores from a finished game (tie %s)',
        (tied) => {
            const game = createGame(count)
            const order = game.players.map((player) => player.id).reverse()
            const state = IndonesiaRuntime.hydrator.hydrateState(
                engine.startGame(game, { startingPositions: { playerIds: order } }).initialState
            )
            const [first, second] = order
            order.forEach((playerId, index) => {
                const player = state.getPlayerState(playerId)
                player.cash = 100 + index
                player.bank = 10 * index
            })
            state.getPlayerState(first).cash = 150
            state.getPlayerState(first).bank = 20
            state.getPlayerState(second).cash = tied ? 140 : 150
            state.getPlayerState(second).bank = 10
            state.operationsEarningsByPlayerId = { [second]: 10 }
            state.era = Era.C
            state.availableDeeds = []

            const context = new MachineContext({ gameState: state, gameConfig: game.config })
            state.machineState = resolvePostOperationsState(state, context)
            expect(state.machineState).toBe(MachineState.EndOfGame)
            IndonesiaRuntime.stateHandlers[MachineState.EndOfGame].enter(context)

            expect(state.result).toBe(GameResult.Win)
            expect(state.winningPlayerIds).toEqual([tied ? first : second])
            expect(() => validateGameResult(state.dehydrate())).not.toThrow()

            assertExists(IndonesiaRuntime.scoring, 'Indonesia declares final scores')
            const finalScores = IndonesiaRuntime.scoring.finalScores(state.dehydrate())
            expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
            expect(finalScores).toEqual(
                Object.fromEntries(
                    order.map((playerId) => {
                        const player = state.getPlayerState(playerId)
                        return [playerId, player.cash + player.bank]
                    })
                )
            )
            expect(finalScores[first]).toBe(170)
            expect(finalScores[second]).toBe(tied ? 170 : 180)
            const best = Math.max(...Object.values(finalScores))
            expect(finalScores[state.winningPlayerIds[0]]).toBe(best)
        }
    )
})

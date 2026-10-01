import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    validateGameResult,
    type Game
} from '@tabletop/common'
import {
    MagnaGreciaGameStateValidator,
    type MagnaGreciaGameState,
    type MagnaGreciaProjectedState
} from '../model/gameState.js'
import { ActionType } from './actions.js'
import { GameLength } from './config.js'
import { Definition } from './definition.js'
import { MagnaGreciaRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(MagnaGreciaRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number, gameLength: GameLength): Game {
    return MagnaGreciaRuntime.initializer.initializeGame(
        {
            id: 'magna-grecia-competition',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: { gameLength },
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

function seatOrders(playerIds: string[]): string[][] {
    const rotations = (ids: string[]) =>
        ids.map((_, offset) => [...ids.slice(offset), ...ids.slice(0, offset)])
    return [...rotations(playerIds), ...rotations(playerIds.toReversed())]
}

function canonical(state: MagnaGreciaProjectedState): MagnaGreciaGameState {
    if (!MagnaGreciaGameStateValidator.Check(state)) {
        throw new Error('Expected complete canonical state')
    }
    return state
}

function endTurn(game: Game, state: MagnaGreciaProjectedState): MagnaGreciaProjectedState {
    const [playerId] = state.activePlayerIds
    assertExists(playerId, 'Expected an acting player')
    return engine.executeCanonicalAction({
        game,
        state,
        action: {
            id: `end-${state.actionCount}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            type: ActionType.EndTurn
        }
    }).updatedState
}

function sortedColors(state: MagnaGreciaProjectedState) {
    return state.players.map((player) => player.color).toSorted()
}

describe.each([2, 3, 4])('Magna Grecia tournaments with %i players', (count) => {
    describe.each([GameLength.Full, GameLength.Short])('%s game', (gameLength) => {
        it('starts with seat one and follows the assigned seats through the first round', () => {
            const game = createGame(count, gameLength)
            for (const order of seatOrders(game.players.map((player) => player.id))) {
                const { initialState, startedGame } = engine.startGame(game, {
                    masterSeed,
                    startingPositions: { playerIds: order }
                })
                expect(startedGame.protectedInformation).toBe(true)
                expect(initialState.turnManager.turnOrder).toEqual(order)
                expect(initialState.roundOrder).toEqual(order)
                let state = initialState
                for (const playerId of order) {
                    expect(state.round).toBe(0)
                    expect(state.activePlayerIds).toEqual([playerId])
                    state = endTurn(game, state)
                }
                expect(state.round).toBe(1)
            }
        })

        it('keeps the ordinary seeded setup apart from who sits where', () => {
            const game = createGame(count, gameLength)
            const uninitialized = engine.generateUninitializedState(game, masterSeed)
            const initialize = (playerIds?: string[]) =>
                MagnaGreciaRuntime.initializer
                    .initializeGameState(
                        game,
                        structuredClone(uninitialized),
                        playerIds ? { playerIds } : undefined
                    )
                    .dehydrate()
            const normal = initialize()
            expect({ ...initialize(normal.roundOrder), turnManager: normal.turnManager }).toEqual(
                normal
            )
            for (const order of seatOrders(game.players.map((player) => player.id))) {
                const assigned = initialize(order)
                expect(initialize(order)).toEqual(assigned)
                expect(assigned.roundOrder).toEqual(order)
                expect(sortedColors(assigned)).toEqual(sortedColors(normal))
                expect({
                    ...assigned,
                    players: normal.players,
                    turnManager: normal.turnManager,
                    roundOrder: normal.roundOrder
                }).toEqual(normal)
                for (const perspective of [
                    { kind: 'spectator' } as const,
                    ...order.map((playerId) => ({ kind: 'player', playerId }) as const)
                ]) {
                    const view = MagnaGreciaRuntime.visibility.state.project(
                        canonical(assigned),
                        perspective,
                        { config: game.config }
                    )
                    expect(view).not.toHaveProperty('deck')
                    expect(view.roundOrder).toEqual(order)
                    expect(() => MagnaGreciaRuntime.hydrator.hydrateState(view)).not.toThrow()
                }
            }
        })

        it('records a valid result for a finished assigned game', () => {
            const game = createGame(count, gameLength)
            const order = game.players.map((player) => player.id).toReversed()
            let state = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            }).initialState
            for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
                expect(step).toBeLessThan(count * 12)
                state = endTurn(game, state)
            }
            expect(() => validateGameResult(state)).not.toThrow()
            const finalScores = MagnaGreciaRuntime.scoring.finalScores(state)
            expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
            const best = Math.max(...Object.values(finalScores))
            expect(state.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
                true
            )
        })
    })
})

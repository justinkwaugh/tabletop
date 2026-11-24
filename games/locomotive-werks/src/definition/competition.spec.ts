import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    assert,
    assertExists,
    validateGameResult,
    type GameConfig
} from '@tabletop/common'
import { LwGameStateValidator, type LwGameState } from '../model/gameState.js'
import { botAction, createGame } from '../testing/bot.js'
import { ActionType } from './actions.js'
import { StartingCash } from './gameConfig.js'
import { LwRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(LwRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

// Every option that changes setup or who acts first.
const CONFIGS: GameConfig[] = [
    {},
    { startingCash: StartingCash.Queen },
    { startingCash: StartingCash.Winsome },
    { buyAndShip: true }
]

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function bySeat(state: LwGameState) {
    return [...state.players].sort((a, b) => a.playerId.localeCompare(b.playerId))
}

describe.each([3, 4, 5])('Locomotive Werks tournaments with %i players', (count) => {
    describe.each(CONFIGS)('config %o', (config) => {
        it('lets seat one develop first and the later seats follow in order', () => {
            const game = createGame(count, config)
            for (const order of rotations(game.players.map((player) => player.id))) {
                let state = engine.startGame(game, {
                    masterSeed,
                    startingPositions: { playerIds: order }
                }).initialState
                expect(state.turnManager.turnOrder).toEqual(order)
                const developers: string[] = []
                // Five players start without werks, so a round of passes runs on to the next one.
                for (let seat = 0; seat < count; seat++) {
                    expect(state.machineState).toBe(MachineState.Developing)
                    const [playerId] = state.activePlayerIds
                    assertExists(playerId, 'Someone develops')
                    developers.push(playerId)
                    state = engine.executeCanonicalAction({
                        game,
                        state,
                        action: {
                            id: `pass-${developers.length}`,
                            gameId: game.id,
                            source: ActionSource.User,
                            playerId,
                            type: ActionType.PassDevelopment
                        }
                    }).updatedState
                }
                expect(developers).toEqual(order)
                expect(state.activePlayerIds).toEqual([order[0]])
            }
        })

        it('keeps ordinary seeded setup apart from the order', () => {
            const game = createGame(count, config)
            const uninitialized = engine.generateUninitializedState(game, masterSeed)
            const initialize = (playerIds?: string[]) =>
                LwRuntime.initializer
                    .initializeGameState(
                        game,
                        structuredClone(uninitialized),
                        playerIds ? { playerIds } : undefined
                    )
                    .dehydrate()
            const normal = initialize()
            expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
            for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
                const assigned = initialize(order)
                assert(LwGameStateValidator.Check(assigned), 'Setup must be canonical')
                expect(assigned.turnManager.turnOrder).toEqual(order)
                expect(assigned.players.map((player) => player.playerId)).toEqual(order)
                expect({
                    ...assigned,
                    players: bySeat(assigned),
                    turnManager: normal.turnManager,
                    activePlayerIds: normal.activePlayerIds
                }).toEqual({ ...normal, players: bySeat(normal) })
            }
        })
    })

    it('scores a finished assigned game by cash and declares the richest', () => {
        const game = createGame(count, {})
        const order = game.players.map((player) => player.id).reverse()
        let state = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: order }
        }).initialState
        for (let step = 0; state.result === undefined; step++) {
            assert(step < 20000, 'The game did not finish')
            const [playerId] = state.activePlayerIds
            assertExists(playerId, `No active player in ${state.machineState}`)
            const action = botAction(LwRuntime.hydrator.hydrateState(state), playerId, step)
            state = engine.executeCanonicalAction({ game, state, action }).updatedState
        }
        assert(LwGameStateValidator.Check(state), 'Finished state must be canonical')
        expect(() => validateGameResult(state)).not.toThrow()
        const finalScores = LwRuntime.scoring.finalScores(state)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        const best = Math.max(...Object.values(finalScores))
        expect(state.winningPlayerIds.length).toBeGreaterThan(0)
        expect(state.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
    })
})

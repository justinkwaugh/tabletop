import { assertExists, GameResult, validateGameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { chooseAction, createGame, engine, playToEnd } from '../util/testPlaythrough.js'
import { ActionType } from './actions.js'
import { BridgesRuntime } from './runtime.js'

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

describe.each([3, 4])('Bridges of Shangri-La tournaments with %i players', (count) => {
    it('honors every starting seat through the first round of turns', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState, startedGame } = engine.startGame(game, {
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.turnManager.series[0].playerId).toBe(order[0])
            expect(startedGame.startedAt).toBeDefined()
            let state = initialState
            for (const [index, playerId] of order.entries()) {
                expect(state.activePlayerIds).toEqual([playerId])
                const action = chooseAction(BridgesRuntime.hydrator.hydrateState(state), index)
                expect(action.type).toBe(ActionType.PlaceMaster)
                state = engine.executeCanonicalAction({ game, state, action }).updatedState
            }
            expect(state.activePlayerIds).toEqual([order[0]])
        }
    })

    it('preserves ordinary seeded setup, colors and later random draws', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game)
        const initialize = (playerIds?: string[]) =>
            BridgesRuntime.initializer
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
            expect(initialize(order)).toEqual(assigned)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
            expect(assigned.players.map((player) => [player.playerId, player.color])).toEqual(
                normal.players.map((player) => [player.playerId, player.color])
            )
            expect(assigned.prng).toEqual(normal.prng)
        }
    })

    it('reproduces assigned setup deterministically', () => {
        const game = createGame(count)
        const playerIds = game.players.map((player) => player.id).reverse()
        const start = () =>
            engine.startGame(game, { startingPositions: { playerIds } }).initialState
        const first = start()
        expect({ ...start(), id: first.id, protectedPrng: first.protectedPrng }).toEqual(first)
    })

    it.each(rotations(Array.from({ length: count }, (_, index) => `p${index}`)))(
        'declares winners and final scores from a finished game starting with %s',
        (...order) => {
            const game = createGame(count)
            const finished = playToEnd(
                game,
                engine.startGame(game, { startingPositions: { playerIds: order } }).initialState
            )
            expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
            expect(finished.winningPlayerIds.length).toBeGreaterThan(0)
            expect(finished.result === GameResult.Draw).toBe(finished.winningPlayerIds.length > 1)
            expect(() => validateGameResult(finished)).not.toThrow()

            const hydrated = BridgesRuntime.hydrator.hydrateState(finished)
            const finalScores = BridgesRuntime.scoring?.finalScores(finished)
            expect(finalScores).toEqual(
                Object.fromEntries(
                    order
                        .toSorted()
                        .map((playerId) => [playerId, hydrated.board.numMastersForPlayer(playerId)])
                )
            )
            assertExists(finalScores, 'Expected final scores')
            const best = Math.max(...Object.values(finalScores))
            for (const playerId of finished.winningPlayerIds) {
                expect(finalScores[playerId]).toBe(best)
            }
        }
    )
})

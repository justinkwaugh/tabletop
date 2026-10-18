import {
    assertExists,
    GameEngine,
    GameResult,
    MachineContext,
    validateGameResult
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { RuleSet } from './gameConfig.js'
import { FreshFishRuntime, FreshFishVisibility } from './runtime.js'
import { MachineState } from './states.js'
import { createTestGame, firstEmptyCellDisk } from '../util/testHelper.js'

const engine = new GameEngine(FreshFishRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

describe.each([2, 3, 4, 5])('Fresh Fish tournaments with %i players', (count) => {
    it('honors every starting seat through actual first-round turns', () => {
        const game = createTestGame(count)
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
            for (const playerId of order) {
                expect(state.activePlayerIds).toEqual([playerId])
                const action = firstEmptyCellDisk(game, state, playerId)
                state = engine.executeCanonicalAction({ game, state, action }).updatedState
            }
            expect(state.activePlayerIds).toEqual([order[0]])
        }
    })

    it.each([false, true])(
        'preserves ordinary seeded setup and options (variant %s)',
        (variant) => {
            const game = createTestGame(count, {
                ruleSet: variant ? RuleSet.Classic : RuleSet.Kyles,
                ...(variant ? { boardSeed: 0 } : {})
            })
            const uninitialized = engine.generateUninitializedState(game, masterSeed)
            const initialize = (playerIds?: string[]) =>
                FreshFishRuntime.initializer
                    .initializeGameState(
                        game,
                        structuredClone(uninitialized),
                        playerIds ? { playerIds } : undefined
                    )
                    .dehydrate()
            const normal = initialize()
            expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
            const order = [...normal.turnManager.turnOrder].reverse()
            const assigned = initialize(order)
            expect(initialize(order)).toEqual(assigned)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
            if (variant) expect(assigned.boardSeed).toBe(0)
            for (const perspective of [
                ...order.map((playerId) => ({ kind: 'player', playerId }) as const),
                { kind: 'spectator' } as const
            ]) {
                const projected = FreshFishVisibility.state.project(assigned, perspective)
                expect(projected.turnManager.turnOrder).toEqual(order)
                expect(projected.tileBag.items).toEqual([])
                expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            }
        }
    )

    it.each([false, true])(
        'records the terminal winners used by tournament scoring (tie %s)',
        (tied) => {
            const game = createTestGame(count)
            const state = FreshFishRuntime.hydrator.hydrateState(
                engine.startGame(game, {
                    masterSeed,
                    startingPositions: {
                        playerIds: game.players.map((player) => player.id).reverse()
                    }
                }).initialState
            )
            state.players.forEach((player, index) => {
                player.money = index === 0 || (tied && index === 1) ? 15 : 10
            })
            state.machineState = MachineState.EndOfGame
            FreshFishRuntime.stateHandlers[MachineState.EndOfGame].enter(
                new MachineContext({ gameState: state, gameConfig: game.config })
            )
            expect(state.result).toBe(tied ? GameResult.Draw : GameResult.Win)
            expect(state.winningPlayerIds).toEqual(tied ? ['p0', 'p1'] : ['p0'])
            expect(() => validateGameResult(state.dehydrate())).not.toThrow()
            const scoring = FreshFishRuntime.scoring
            assertExists(scoring, 'Fresh Fish declares final scores')
            const finalScores = scoring.finalScores(state.dehydrate())
            expect(finalScores).toEqual(
                Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
            )
            const best = Math.max(...Object.values(finalScores))
            expect(
                Object.keys(finalScores).filter((playerId) => finalScores[playerId] === best)
            ).toEqual(state.winningPlayerIds)
            expect(finalScores.p1 === finalScores.p0).toBe(tied)
        }
    )
})

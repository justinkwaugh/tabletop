import { describe, expect, it } from 'vitest'
import {
    GameResult,
    MachineContext,
    assert,
    validateGameResult,
    type GameConfig
} from '@tabletop/common'
import {
    DickeKartoffelnGameStateValidator,
    type DickeKartoffelnProjectedState
} from '../model/gameState.js'
import { createGame } from '../testing/bot.js'
import { engine, masterSeed } from '../testing/table.js'
import { botAction } from '../testing/bot.js'
import { MessageRule } from './gameConfig.js'
import { DickeKartoffelnRuntime } from './runtime.js'
import { MachineState } from './states.js'

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function playToEnd(config: GameConfig, initial: DickeKartoffelnProjectedState, count: number) {
    const game = createGame(count, config)
    let state = initial
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 5000, 'The game did not finish')
        const [playerId] = state.activePlayerIds
        const action = botAction(
            DickeKartoffelnRuntime.hydrator.hydrateState(state),
            playerId,
            step
        )
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return state
}

const SETUPS: GameConfig[] = [
    { messages: MessageRule.EveryYear },
    { messages: MessageRule.FromSecondYear },
    { messages: MessageRule.Never }
]

describe.each([2, 3, 4, 5, 6])('Dicke Kartoffeln tournaments with %i players', (count) => {
    it.each(SETUPS)('seats players in their assigned order ($messages)', (config) => {
        const game = createGame(count, config)
        const uninitialized = engine.generateUninitializedState(game, masterSeed)
        const initialize = (playerIds?: string[]) =>
            DickeKartoffelnRuntime.initializer
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
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
            assert(DickeKartoffelnGameStateValidator.Check(assigned), 'Setup must be canonical')
            const { initialState, startedGame } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            expect(startedGame.protectedInformation).toBe(true)
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.machineState).toBe(MachineState.TakingCompost)
            expect(initialState.activePlayerIds).toEqual(game.players.map((player) => player.id))
        }
    })

    it('scores every farmer from an actual finished assigned game', () => {
        const config = { years: '4' }
        const game = createGame(count, config)
        const order = game.players.map((player) => player.id).reverse()
        const { initialState } = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: order }
        })
        const finished = playToEnd(config, initialState, count)
        assert(DickeKartoffelnGameStateValidator.Check(finished), 'Finished state is canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        const finalScores = DickeKartoffelnRuntime.scoring.finalScores(finished)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        const best = Math.max(...Object.values(finalScores))
        expect(finished.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
        const spectatorView = DickeKartoffelnRuntime.visibility.state.project(finished, {
            kind: 'spectator'
        })
        expect(DickeKartoffelnRuntime.scoring.finalScores(spectatorView)).toEqual(finalScores)
    })
})

describe('Dicke Kartoffeln terminal results', () => {
    it.each([
        { points: [10, 7, 3], winners: ['p0'] },
        { points: [8, 8, 3], winners: ['p0', 'p1'] },
        { points: [5, 5, 5], winners: ['p0', 'p1', 'p2'] }
    ])('declares winners for points $points', ({ points, winners }) => {
        const game = createGame(3)
        const state = DickeKartoffelnRuntime.hydrator.hydrateState(
            engine.startGame(game, { masterSeed }).initialState
        )
        state.standings = state.players.map((player, index) => ({
            playerId: player.playerId,
            economy: 0,
            ecology: 0,
            economyPoints: points[index],
            ecologyPoints: 0,
            points: points[index]
        }))
        state.machineState = MachineState.EndOfGame
        DickeKartoffelnRuntime.stateHandlers[MachineState.EndOfGame].enter(
            new MachineContext({ gameState: state, gameConfig: game.config })
        )
        expect(state.result).toBe(winners.length === 1 ? GameResult.Win : GameResult.Draw)
        expect(state.winningPlayerIds).toEqual(winners)
        expect(() => validateGameResult(state.dehydrate())).not.toThrow()
    })
})

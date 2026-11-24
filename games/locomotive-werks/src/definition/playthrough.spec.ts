import { describe, expect, it } from 'vitest'
import {
    GameEngine,
    GameResult,
    type GameAction,
    type GameConfig,
    assert,
    assertExists,
    validateGameResult
} from '@tabletop/common'
import { DICE, WINNING_CASH } from '../model/locomotives.js'
import { diceOnSpace } from '../model/market.js'
import type { LwGameState } from '../model/gameState.js'
import { botAction, createGame } from '../testing/bot.js'
import { LwRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { StartingCash } from './gameConfig.js'

const engine = new GameEngine(LwRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'
const STEP_LIMIT = 20000

function* play(count: number, config: GameConfig) {
    const game = createGame(count, config)
    let state = engine.startGame(game, { masterSeed }).initialState
    for (let step = 0; state.result === undefined; step++) {
        assert(step < STEP_LIMIT, 'Playthrough did not finish')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(LwRuntime.hydrator.hydrateState(state), playerId, step)
        const result = engine.executeCanonicalAction({ game, state, action })
        yield { game, before: state, result }
        state = result.updatedState
    }
}

function playToEnd(count: number, config: GameConfig): LwGameState {
    let last: LwGameState | undefined
    for (const { result } of play(count, config)) {
        last = result.updatedState
    }
    assertExists(last, 'The game took no actions')
    return last
}

const CONFIGS: { name: string; config: GameConfig }[] = [
    { name: 'standard rules', config: {} },
    { name: 'Queen Start Money', config: { startingCash: StartingCash.Queen } },
    { name: 'Winsome Starting Cash', config: { startingCash: StartingCash.Winsome } },
    { name: 'Buy and Ship', config: { buyAndShip: true } }
]

describe.each(
    CONFIGS.flatMap(({ name, config }) => [3, 4, 5].map((count) => ({ name, config, count })))
)('a $count player game with $name', ({ config, count }) => {
    it('plays until someone has $300 after taxes and declares the richest', () => {
        const finished = playToEnd(count, config)
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
        expect(() => validateGameResult(finished)).not.toThrow()
        const best = Math.max(...finished.players.map((player) => player.cash))
        expect(best).toBeGreaterThanOrEqual(WINNING_CASH)
        const scores = LwRuntime.scoring.finalScores(finished)
        expect(finished.winningPlayerIds.every((playerId) => scores[playerId] === best)).toBe(true)
        expect(finished.turnManager.seriesKeeps).toBe('latest')
        expect(finished.turnManager.series.length).toBeLessThanOrEqual(count + 1)
        const again = playToEnd(count, config)
        expect({ ...again, id: finished.id }).toEqual(finished)
    })

    it('never has more than twenty dice on the board or more dice than Customer Base boxes', () => {
        for (const { result } of play(count, config)) {
            const state = LwRuntime.hydrator.hydrateState(result.updatedState)
            const onBoard = state.spaces.reduce((sum, space) => sum + diceOnSpace(space), 0)
            expect(onBoard).toBeLessThanOrEqual(DICE)
            for (const space of state.spaces) {
                expect(space.existingOrders.every((face) => face >= 1 && face <= 6)).toBe(true)
                expect(space.cards).toBeGreaterThanOrEqual(0)
            }
            for (const player of state.players) {
                expect(player.cash).toBeGreaterThanOrEqual(0)
                expect(player.plants.every((plant) => plant.units > 0)).toBe(true)
            }
        }
    })

    it('replays and undoes every processed action', () => {
        const history: { action: GameAction; before: LwGameState }[] = []
        let initial: LwGameState | undefined
        let state: LwGameState | undefined
        for (const { game, before, result } of play(count, config)) {
            initial ??= before
            let replay = before
            for (const processed of result.processedActions) {
                history.push({ action: processed, before: replay })
                replay = engine.applyProcessedAction({ game, state: replay, action: processed })
            }
            expect(replay).toEqual(result.updatedState)
            state = result.updatedState
        }
        assertExists(state, 'The game took no actions')
        let undone = state
        for (const { action, before } of history.toReversed()) {
            undone = engine.undoProcessedAction({ state: undone, action })
            expect(undone).toEqual(before)
        }
        expect(undone).toEqual(initial)
    })
})

import { describe, expect, it } from 'vitest'
import { assert, assertExists, validateGameResult, type GameAction } from '@tabletop/common'
import { isDeterminePlayerOrder } from '../actions/determinePlayerOrder.js'
import { isPayDividends } from '../actions/payDividends.js'
import type { OstbahnGameState } from '../model/gameState.js'
import { botAction } from '../testing/bot.js'
import { createGame, engine, masterSeed } from '../testing/table.js'
import { OstbahnRuntime } from './runtime.js'
import { MachineState } from './states.js'

function playToEnd(count: number, seed: number) {
    const game = createGame(count, seed)
    const initial = engine.startGame(game, {
        masterSeed: `${masterSeed.slice(0, -2)}${seed}`
    }).initialState
    const history: GameAction[] = []
    let state: OstbahnGameState = initial
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 4000, 'Playthrough did not finish')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(OstbahnRuntime.hydrator.hydrateState(state), playerId, step)
        const result = engine.executeCanonicalAction({ game, state, action })
        history.push(...result.processedActions)
        state = result.updatedState
    }
    return { game, initial, history, final: state }
}

describe.each([3, 4, 5])('Preußische Ostbahn with %i players', (count) => {
    it.each([11, 12, 13])('plays seed %i to the end', (seed) => {
        const { history, final } = playToEnd(count, seed)
        expect(final.machineState).toBe(MachineState.EndOfGame)
        expect(() => validateGameResult(final)).not.toThrow()
        const ends = history.filter(isDeterminePlayerOrder).at(-1)?.metadata?.endReason
        const dividends = history.filter(isPayDividends).length
        const rounds = final.rounds.series.length
        console.log(
            `${count}p seed ${seed}: ${ends} after ${rounds} rounds, ${dividends} dividends, cash ${final.players.map((p) => p.cash).join('/')}`
        )
        expect(ends).toBeDefined()
    })

    it('replays its history to the same state', () => {
        const { game, initial, history, final } = playToEnd(count, 11)
        let state = initial
        for (const action of history) {
            state = engine.applyProcessedAction({ game, state, action })
        }
        expect(state).toEqual(final)
    })
})

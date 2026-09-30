import { engine } from '../testing/engine.js'
import { buildAction, machineContext } from '../testing/actions.js'
import { EndOfGameStateHandler } from './endOfGame.js'
import { describe, expect, it } from 'vitest'
import { GameResult } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { CompleteRest, FINAL_ROUND } from '../actions/completeRest.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { Travel } from '../actions/travel.js'
import { testPlayer, testState } from '../testing/fixture.js'
import type { OathProjectedState } from '../model/gameState.js'
import { testGame } from '../testing/game.js'
import { twoSeatActPhase } from '../testing/tables.js'

function playToEnd(): OathProjectedState {
    // Fixed ids: the action checksum hashes each id, so replays agree only on identical logs.
    const game = testGame(['p1', 'p2'])
    let state = twoSeatActPhase('p2', { oathkeeperPlayerId: 'p1', round: FINAL_ROUND })
    state = engine.runNext(buildAction(EndActPhase, { playerId: 'p2' }), state, game).updatedState
    state = engine.runNext(buildAction(CompleteRest, { playerId: 'p2' }), state, game).updatedState
    return state
}

describe('the game-end cycle (R-3.4 at round 8, through GameEngine.run)', () => {
    it('ends the game atomically inside the closing action: winner, result, machine state', () => {
        const state = playToEnd()

        // R-3.4.1 — at War Exhaustion with the Empire holding the title, the Chancellor wins.
        expect(state.winningPlayerIds).toEqual(['p1'])
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        expect(state.activePlayerIds).toEqual([])
        expect(state.round).toBe(FINAL_ROUND)
    })

    it('accepts no further play: a post-game action is rejected', () => {
        const game = testGame(['p1', 'p2'])
        const state = playToEnd()
        expect(() =>
            engine.runNext(buildAction(Travel, { playerId: 'p1', siteId: 'c2' }), state, game).updatedState
        ).toThrow()
    })

    it('refuses to open without the one winner the ending action records', () => {
        const state = testState([testPlayer({ playerId: 'p1' })], {
            machineState: MachineState.EndOfGame
        })
        expect(() => new EndOfGameStateHandler().enter(machineContext(state))).toThrow(
            /records its one winner/
        )
    })

    it('the terminal state offers no action to any player', () => {
        const game = testGame(['p1', 'p2'])
        const state = playToEnd()
        expect(engine.getValidActionTypesForPlayer(game, state, 'p1')).toEqual([])
        expect(engine.getValidActionTypesForPlayer(game, state, 'p2')).toEqual([])
    })

    it('no Chronicle artifact exists in the final state (not started — pinned)', () => {
        const state = playToEnd()
        const served: Record<string, unknown> = state
        expect(served['chronicle']).toBeUndefined()
        expect(served['chronicleWorld']).toBeUndefined()
        expect(JSON.stringify(state)).not.toMatch(/chronicle/i)
    })

    it('the ending is deterministic: two replays of the closing turn agree exactly', () => {
        const a = playToEnd()
        const b = playToEnd()
        expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    })
})

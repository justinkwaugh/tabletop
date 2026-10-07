import { describe, expect, it } from 'vitest'
import { GameEngine, GameResult, assert, assertExists, validateGameResult } from '@tabletop/common'
import { isGrocer } from '../components/companies.js'
import type { HcgGameState, HydratedHcgGameState } from '../model/gameState.js'
import { ACTIONS_PER_ROUND } from '../model/actionSpaces.js'
import { botAction, createGame } from '../testing/bot.js'
import { HcgRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(HcgRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function playToEnd(count: number, check?: (state: HydratedHcgGameState) => void): HcgGameState {
    const game = createGame(count)
    let state = engine.startGame(game, { masterSeed }).initialState
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 5000, 'Playthrough did not finish')
        const hydrated = HcgRuntime.hydrator.hydrateState(state)
        check?.(hydrated)
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        state = engine.executeCanonicalAction({
            game,
            state,
            action: botAction(hydrated, playerId, step)
        }).updatedState
    }
    return state
}

describe.each([3, 4, 5])('a %i player game', (count) => {
    it('plays from the initial auction to a declared result', () => {
        const finished = playToEnd(count)
        const hydrated = HcgRuntime.hydrator.hydrateState(finished)
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(hydrated.isGameEndTriggered()).toBe(true)
        expect(finished.dividendsPaid).toBeGreaterThan(0)
        expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
        expect(() => validateGameResult(finished)).not.toThrow()

        const scores = HcgRuntime.scoring.finalScores(finished)
        const best = Math.max(...Object.values(scores))
        expect(finished.winningPlayerIds.every((playerId) => scores[playerId] === best)).toBe(true)
        const again = playToEnd(count)
        expect({ ...again, id: finished.id }).toEqual(finished)
    })

    it('keeps money, cubes, markers and shares within their limits', () => {
        playToEnd(count, (state) => {
            expect(state.roundTrack.length).toBeLessThanOrEqual(ACTIONS_PER_ROUND)
            expect(state.markersRemaining()).toBeGreaterThanOrEqual(0)
            for (const company of state.companies) {
                expect(company.treasury).toBeGreaterThanOrEqual(0)
                expect(state.unsoldShares(company.id)).toBeGreaterThanOrEqual(0)
                if (isGrocer(company.id)) {
                    expect(state.cubesRemaining(company.id)).toBeGreaterThanOrEqual(0)
                }
            }
            for (const player of state.players) {
                expect(player.cash).toBeGreaterThanOrEqual(0)
            }
        })
    })
})

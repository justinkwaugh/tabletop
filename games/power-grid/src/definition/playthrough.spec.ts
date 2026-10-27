import { describe, expect, it } from 'vitest'
import { GameResult, validateGameResult } from '@tabletop/common'
import { MachineState } from './states.js'
import { Step } from '../components/rules.js'
import { TestGame } from '../testing/testGame.js'

function playToEnd(count: number) {
    const game = new TestGame(count)
    const steps = new Set<Step>()
    game.playUntil((state) => {
        steps.add(state.step)
        return state.result !== undefined
    })
    return { state: game.state, steps: [...steps] }
}

describe.each([2, 3, 4, 5, 6])('a %i player game', (count) => {
    it('plays to a declared result through all three steps', () => {
        const { state, steps } = playToEnd(count)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect([GameResult.Win, GameResult.Draw]).toContain(state.result)
        expect(() => validateGameResult(state)).not.toThrow()
        expect(steps).toContain(Step.Three)
        expect({ ...playToEnd(count).state, id: state.id }).toEqual(state)
    })
})

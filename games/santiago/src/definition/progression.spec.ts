import {
    assert,
    assertExists,
    GameEngine,
    GameProgress,
    reportGameProgress
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { createTestGame } from '../testing/testGame.js'
import type { SantiagoProjectedState } from '../model/gameState.js'
import { nextAction } from '../testing/autoplay.js'
import { SantiagoRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(SantiagoRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function report(state: SantiagoProjectedState): GameProgress {
    const progress = reportGameProgress(SantiagoRuntime, state)
    assertExists(progress, 'Santiago reports Game Progress')
    expect(Value.Check(GameProgress, progress)).toBe(true)
    return progress
}

describe.each([
    [3, 11],
    [4, 11],
    [5, 9]
])('Santiago Game Progress with %i players', (count, rounds) => {
    it.each([true, false])('counts the rounds to the last (random spring %s)', (randomSpring) => {
        const game = createTestGame(count, { randomizeSpring: randomSpring, palmTrees: true })
        const { startedGame, initialState } = engine.startGame(game, { masterSeed })
        const reports = [report(initialState)]
        let state = initialState
        for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
            assert(step < 1000, 'Playthrough did not finish')
            state = engine.executeCanonicalAction({
                game: startedGame,
                state,
                action: nextAction(state, game.id)
            }).updatedState
            const progress = report(state)
            expect(progress.final === true).toBe(state.round === rounds)
            reports.push(progress)
        }
        expect(state.round).toBe(rounds)
        expect(reports[0]).toEqual({ fraction: 0, label: `Round 1 of ${rounds}` })
        for (const [index, progress] of reports.entries())
            expect(progress.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
        const labels = new Set(reports.map((progress) => progress.label))
        expect([...labels]).toEqual([
            ...Array.from({ length: rounds - 1 }, (_, index) => `Round ${index + 1} of ${rounds}`),
            'Last round'
        ])
        expect(reports.find((progress) => progress.label === 'Last round')).toEqual({
            fraction: Math.round(((rounds - 1) / rounds) * 1000) / 1000,
            label: 'Last round',
            final: true
        })
        expect(state.result).toBeDefined()
        expect(reports.at(-1)).toEqual({ fraction: 1, label: 'Last round', final: true })
    })
})

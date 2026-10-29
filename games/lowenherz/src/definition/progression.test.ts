import { assertExists, GameEngine, GameProgress, reportGameProgress } from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { createTestGame } from '../util/testGame.js'
import type { LowenherzProjectedState } from '../model/gameState.js'
import { nextAction } from '../testing/autoplay.js'
import { ActionCardDeck, CardBack } from './actionCards.js'
import { LowenherzRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(LowenherzRuntime)
const visibility = LowenherzRuntime.visibility
assertExists(visibility, 'Löwenherz projects state')
const masterSeed = '0123456789abcdef0123456789abcdef'
const basicDeckSize = ActionCardDeck.filter((card) => card.back !== CardBack.A).length

function report(state: LowenherzProjectedState): GameProgress {
    const progress = reportGameProgress(LowenherzRuntime, state)
    assertExists(progress, 'Löwenherz reports Game Progress')
    return progress
}

describe.each([
    { count: 2, standardSetup: false, startingDeck: ActionCardDeck.length },
    { count: 2, standardSetup: true, startingDeck: ActionCardDeck.length },
    { count: 3, standardSetup: false, startingDeck: ActionCardDeck.length },
    { count: 3, standardSetup: true, startingDeck: basicDeckSize },
    { count: 4, standardSetup: false, startingDeck: ActionCardDeck.length },
    { count: 4, standardSetup: true, startingDeck: basicDeckSize }
])(
    'Löwenherz Game Progress with $count players (standard setup $standardSetup)',
    ({ count, standardSetup, startingDeck }) => {
        it('counts the action deck down to the King possibly dying', () => {
            const game = createTestGame(count, { standardSetup })
            const { startedGame, initialState } = engine.startGame(game, { masterSeed })
            const reports = [report(initialState)]
            let state = initialState
            for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
                expect(step).toBeLessThan(5000)
                state = engine.executeCanonicalAction({
                    game: startedGame,
                    state,
                    action: nextAction(state, startedGame.id)
                }).updatedState
                const progress = report(state)
                expect(Value.Check(GameProgress, progress)).toBe(true)
                const spectatorView = visibility.state.project(
                    state,
                    { kind: 'spectator' },
                    { config: startedGame.config }
                )
                expect(report(spectatorView)).toEqual(progress)
                reports.push(progress)
            }
            expect(reports[0]).toEqual({ fraction: 0, label: `${startingDeck} action cards left` })
            for (const [index, progress] of reports.entries())
                expect(progress.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
            const firstFinal = reports.findIndex((progress) => progress.final)
            expect(reports[firstFinal - 1]?.label).toMatch(/^\d+ action cards left$/)
            expect(reports.slice(firstFinal).every((p) => p.label === 'King may die')).toBe(true)
            expect(reports.slice(firstFinal).every((p) => p.final)).toBe(true)
            expect(reports.slice(0, firstFinal).some((p) => p.final)).toBe(false)
            expect(reports.at(-1)?.label).toBe('King may die')
        })
    }
)

describe('Löwenherz Game Progress from deck backs', () => {
    function stateWithBacks(backs: CardBack[]): LowenherzProjectedState {
        const { initialState } = engine.startGame(createTestGame(3, { standardSetup: true }), {
            masterSeed
        })
        return { ...initialState, actionDeckBacks: backs }
    }

    it('counts only basic-deck cards towards the fraction', () => {
        expect(report(stateWithBacks([CardBack.A, ...Array(25).fill(CardBack.B)]))).toEqual({
            fraction: 0,
            label: '26 action cards left'
        })
        expect(report(stateWithBacks([CardBack.D, CardBack.E, CardBack.E]))).toEqual({
            fraction: Math.round(((basicDeckSize - 3) / basicDeckSize) * 1000) / 1000,
            label: '3 action cards left'
        })
    })

    it('warns that the King may die once only E cards remain', () => {
        expect(report(stateWithBacks([CardBack.E, CardBack.E]))).toEqual({
            fraction: Math.round(((basicDeckSize - 2) / basicDeckSize) * 1000) / 1000,
            label: 'King may die',
            final: true
        })
    })

    it('reads the backs from the deck in saves that predate the public backs', () => {
        const { initialState } = engine.startGame(createTestGame(4, { standardSetup: true }), {
            masterSeed
        })
        const legacy = { ...initialState }
        delete legacy.actionDeckBacks
        expect(report(legacy)).toEqual(report(initialState))
    })
})

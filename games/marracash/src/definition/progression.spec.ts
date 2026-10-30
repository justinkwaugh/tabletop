import { assertExists, GameEngine, GameProgress, reportGameProgress } from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { EntranceFountainIds } from '../components/board.js'
import { startingQueueLength } from '../components/visitors.js'
import type { MarracashProjectedState } from '../model/gameState.js'
import {
    createGame,
    createTestSession,
    playToEnd,
    startTestGame,
    TestMasterSeed
} from '../util/testHelper.js'
import { MarracashRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(MarracashRuntime)
const startingQueue = startingQueueLength(EntranceFountainIds.length)

function report(state: MarracashProjectedState): GameProgress {
    const progress = reportGameProgress(MarracashRuntime, state)
    assertExists(progress, 'MarraCash reports Game Progress')
    expect(Value.Check(GameProgress, progress)).toBe(true)
    return progress
}

describe.each([3, 4])('MarraCash Game Progress with %i players', (count) => {
    it('counts the visitors drawn from the queue, then marks the final round', () => {
        const game = createGame(count)
        const { initialState } = engine.startGame(game, { masterSeed: TestMasterSeed })
        const reports = [report(initialState)]
        const finished = playToEnd(
            createTestSession(game, initialState, (state) => {
                const progress = report(state)
                expect(progress.final === true).toBe(state.finalRound)
                reports.push(progress)
            })
        )
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(initialState.queue).toHaveLength(startingQueue)
        expect(reports[0]).toEqual({ fraction: 0, label: `${startingQueue} visitors waiting` })
        for (const [index, progress] of reports.entries())
            expect(progress.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
        expect(reports.filter((progress) => progress.final).length).toBeGreaterThan(0)
        expect(
            reports.filter((progress) => progress.final).every((p) => p.label === 'Final round')
        ).toBe(true)
        expect(reports.at(-1)).toEqual({ fraction: 1, label: 'Final round', final: true })
    })
})

describe('MarraCash Game Progress labels', () => {
    it('reports the visitors still waiting', () => {
        const session = startTestGame(3)
        session.edit((draft) => {
            draft.queue = draft.queue.slice(-20)
        })
        expect(report(session.state)).toEqual({
            fraction: Math.round(((startingQueue - 20) / startingQueue) * 1000) / 1000,
            label: '20 visitors waiting'
        })
        session.edit((draft) => {
            draft.queue = draft.queue.slice(-1)
        })
        expect(report(session.state).label).toBe('1 visitor waiting')
    })
})

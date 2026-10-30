import { assertExists, GameProgress, reportGameProgress } from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { bridgeCount } from '../components/gameBoard.js'
import type { BridgesGameState } from '../model/gameState.js'
import { createGame, engine, playToEnd } from '../util/testPlaythrough.js'
import { BridgesRuntime } from './runtime.js'

describe.each([
    { count: 3, stones: 10, bridges: 20 },
    { count: 4, stones: 11, bridges: 23 }
])('Bridges of Shangri-La Game Progress with $count players', ({ count, stones, bridges }) => {
    it('counts bridges broken towards the end and stones left in the label', () => {
        const game = createGame(count)
        const initialState = engine.startGame(game).initialState
        expect(bridgeCount(initialState.board)).toBe(bridges)
        expect(initialState.stones).toBe(stones)

        const reports: GameProgress[] = []
        const finished = playToEnd(game, initialState, (state: BridgesGameState) => {
            const progress = reportGameProgress(BridgesRuntime, state)
            assertExists(progress, 'Bridges of Shangri-La reports Game Progress')
            expect(Value.Check(GameProgress, progress)).toBe(true)
            expect(progress.fraction).toBe(
                Math.round((1 - bridgeCount(state.board) / bridges) * 1000) / 1000
            )
            reports.push(progress)
        })
        expect(finished.result).toBeDefined()

        expect(reports[0]).toEqual({ fraction: 0, label: `${stones} stones left` })
        for (const [index, report] of reports.entries())
            expect(report.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
        const labels = reports.map((report) => report.label)
        expect(labels).toContain('2 stones left')
        expect(labels).not.toContain('1 stones left')
        expect(labels.some((label) => label.startsWith('-') || label.startsWith('0'))).toBe(false)
        expect(reports.filter((report) => report.final).length).toBeGreaterThan(0)
        for (const report of reports)
            expect(report.final === true).toBe(report.label === 'Last stone')
        expect(reports.at(-1)).toMatchObject({ label: 'Last stone', final: true })
    })
})

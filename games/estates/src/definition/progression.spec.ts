import { assertExists, GameEngine, GameProgress, reportGameProgress } from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { RoofCount } from '../components/roofBag.js'
import type { EstatesProjectedState } from '../model/gameState.js'
import { EstatesRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { createGame, playToEnd } from './tests/playthrough.js'

const engine = new GameEngine(EstatesRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function roofsDrawnFraction(state: EstatesProjectedState): number {
    return Math.round(((RoofCount - state.roofs.remaining) / RoofCount) * 1000) / 1000
}

function playReportingProgress(count: number, roofsInBag = RoofCount) {
    const game = createGame(count)
    const { initialState } = engine.startGame(game, { masterSeed })
    const start = {
        ...initialState,
        roofs: { items: initialState.roofs.items.slice(0, roofsInBag), remaining: roofsInBag }
    }
    const reports: GameProgress[] = []
    const onState = (state: EstatesProjectedState) => {
        const progress = reportGameProgress(EstatesRuntime, state)
        assertExists(progress, 'Estates reports Game Progress')
        expect(Value.Check(GameProgress, progress)).toBe(true)
        expect(progress.fraction).toBe(roofsDrawnFraction(state))
        reports.push(progress)
    }
    onState(start)
    const finished = playToEnd(game, start, onState)
    for (const [index, progress] of reports.entries())
        expect(progress.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
    return { reports, finished }
}

describe.each([2, 3, 4, 5])('Estates Game Progress with %i players', (count) => {
    it('counts the roofs down until two completed rows end the game', () => {
        const { reports, finished } = playReportingProgress(count)
        expect(reports[0]).toEqual({ fraction: 0, label: `${RoofCount} roofs left` })
        expect(finished.roofs.remaining).toBeGreaterThan(1)
        expect(reports.some((progress) => progress.final)).toBe(false)
        expect(reports.at(-1)).toEqual({
            fraction: roofsDrawnFraction(finished),
            label: `${finished.roofs.remaining} roofs left`
        })
    })

    it('marks the last roof final until it ends the game', () => {
        const { reports, finished } = playReportingProgress(count, 2)
        expect(finished.roofs.remaining).toBe(0)
        const labels = [...new Set(reports.map((progress) => progress.label))]
        expect(labels).toEqual(['2 roofs left', '1 roof left', 'Last roof'])
        expect(reports.find((progress) => progress.label === 'Last roof')).toEqual({
            fraction: 1,
            label: 'Last roof',
            final: true
        })
        expect(
            reports.filter((progress) => progress.final).every((p) => p.label === 'Last roof')
        ).toBe(true)
        expect(reports.at(-1)).toEqual({ fraction: 1, label: 'Last roof', final: true })
        expect(finished.machineState).toBe(MachineState.EndOfGame)
    })
})

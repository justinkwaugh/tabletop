import { GameProgress, assertExists, reportGameProgress } from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { Side } from '../components/pieces.js'
import { ROUNDS, Scenario } from '../components/timeTrack.js'
import { MachineState } from './states.js'
import { TestGame, passTurns } from '../testing/harness.js'
import { ActionType } from './actions.js'
import { NapoleonsTriumphRuntime } from './runtime.js'

describe("Napoleon's Triumph set-up", () => {
    it('raises both armies off the map with the Allies to deploy first', () => {
        const game = new TestGame()
        expect(game.state.machineState).toBe(MachineState.AlliedSetup)
        expect(game.state.units).toHaveLength(80)
        expect(game.state.commanders).toHaveLength(17)
        expect(game.activePlayerId).toBe(game.playerOf(Side.Allied))
        expect(game.hydrated.playerOf(Side.French).morale).toBe(23)
        expect(game.hydrated.playerOf(Side.Allied).morale).toBe(27)
    })

    it('deploys both armies and starts the 7:00AM Allied turn', () => {
        const game = new TestGame()
        game.deployBoth()
        const state = game.hydrated
        expect(state.round).toBe(0)
        expect(game.activePlayerId).toBe(game.playerOf(Side.Allied))
        expect(state.commander('bagration').position).toEqual({ locale: 67 })
        expect(state.commander('davout').position).toBeUndefined()
        expect(state.units.filter((unit) => unit.fixed)).toHaveLength(1)
        for (const commander of state.commanders) {
            const corps = state.corpsUnits(commander.id)
            expect(corps.length).toBeGreaterThan(0)
        }
    })

    it('passes the turn to the French and then to the next round', () => {
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        expect(game.activePlayerId).toBe(game.playerOf(Side.French))
        game.act(ActionType.EndTurn, game.playerOf(Side.French))
        expect(game.hydrated.round).toBe(1)
        expect(game.activePlayerId).toBe(game.playerOf(Side.Allied))
    })
})

describe.each([
    [Scenario.December2, '2 December · 7:00AM', ['2 December · 3:00PM']],
    [Scenario.December1, '1 December · 7:00AM', ['1 December · Night', '2 December · 7:00AM']]
])("Napoleon's Triumph Game Progress in the %s scenario", (scenario, opening, passed) => {
    it('follows the time track to a final last hour', () => {
        const game = new TestGame({ scenario })
        const reports: GameProgress[] = []
        const record = () => {
            const progress = reportGameProgress(NapoleonsTriumphRuntime, game.state)
            assertExists(progress, "Napoleon's Triumph reports Game Progress")
            expect(Value.Check(GameProgress, progress)).toBe(true)
            reports.push(progress)
        }
        record()
        game.deploy(Side.Allied)
        record()
        game.deploy(Side.French)
        record()
        while (game.state.machineState !== MachineState.EndOfGame) {
            passTurns(game, 1)
            record()
        }

        const rounds = ROUNDS[scenario].length
        expect(reports.slice(0, 3)).toEqual(Array(3).fill({ fraction: 0, label: opening }))
        expect(reports[3]).toEqual({ fraction: Math.round(500 / rounds) / 1000, label: opening })
        for (const [index, report] of reports.entries())
            expect(report.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
        expect(reports).toHaveLength(3 + 2 * rounds)
        const labels = reports.map((report) => report.label)
        for (const label of passed) expect(labels).toContain(label)
        const lastHour = '2 December · 4:00PM · Last hour'
        expect(reports.filter((report) => report.final).length).toBeGreaterThan(0)
        for (const report of reports) expect(report.final === true).toBe(report.label === lastHour)
        expect(reports.at(-1)).toEqual({ fraction: 1, label: lastHour, final: true })
    })
})

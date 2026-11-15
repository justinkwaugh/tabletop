import { describe, expect, it } from 'vitest'
import { GameResult, assert, validateGameResult, type GameConfig } from '@tabletop/common'
import { MAX_SUNFLOWERS, MAX_WORMS } from '../components/potatoes.js'
import { DickeKartoffelnGameStateValidator } from '../model/gameState.js'
import { Table } from '../testing/table.js'
import { ActionType } from './actions.js'
import { MessageRule } from './gameConfig.js'
import { DickeKartoffelnRuntime } from './runtime.js'
import { MachineState } from './states.js'

function playToEnd(count: number, config: GameConfig = {}): Table {
    const table = new Table(count, config)
    for (let rounds = 0; table.state.result === undefined; rounds++) {
        assert(rounds < 500, 'Playthrough did not finish')
        table.playRound()
        const state = table.hydrated
        for (const player of state.players) {
            expect(player.cash).toBeGreaterThanOrEqual(0)
            expect(player.loans).toBeGreaterThanOrEqual(0)
            for (const field of player.fields) {
                expect(field.worms).toBeGreaterThanOrEqual(0)
                expect(field.worms).toBeLessThanOrEqual(MAX_WORMS)
                expect(field.sunflowers).toBeLessThanOrEqual(MAX_SUNFLOWERS)
                if (field.worms === 0) expect(field.sunflowers).toBe(0)
            }
        }
    }
    return table
}

describe.each([2, 3, 4, 5, 6])('a %i player game', (count) => {
    it('plays every year to a declared result', () => {
        const table = playToEnd(count)
        const finished = table.state
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        assert(DickeKartoffelnGameStateValidator.Check(finished), 'Finished state is canonical')
        expect(finished.years.series).toHaveLength(6)
        expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
        expect(() => validateGameResult(finished)).not.toThrow()
        const scores = DickeKartoffelnRuntime.scoring.finalScores(finished)
        const best = Math.max(...Object.values(scores))
        expect(finished.winningPlayerIds.every((playerId) => scores[playerId] === best)).toBe(true)
        const types = new Set(table.processed.map((action) => action.type))
        for (const type of Object.values(ActionType)) {
            expect(types).toContain(type)
        }
        const again = playToEnd(count)
        expect({ ...again.state, id: finished.id }).toEqual(finished)
    })
})

describe('game configuration', () => {
    it('plays the agreed number of years', () => {
        expect(playToEnd(3, { years: '4' }).state.years.series).toHaveLength(4)
    })

    it('reads no messages and sprays no poison when messages are off', () => {
        const table = playToEnd(3, { messages: MessageRule.Never })
        expect(table.state.messages).toBeUndefined()
        const types = table.processed.map((action) => action.type)
        expect(types).not.toContain(ActionType.ReadMessage)
        expect(
            table.processed.some(
                (action) =>
                    action.type === ActionType.RevealPlans &&
                    'step' in action &&
                    action.step === MachineState.Spraying
            )
        ).toBe(false)
    })

    it('starts reading messages in the second year when asked to', () => {
        const table = playToEnd(3, { messages: MessageRule.FromSecondYear })
        const reads = table.processed.filter((action) => action.type === ActionType.ReadMessage)
        expect(reads).toHaveLength(5)
        const firstYearEnd = table.state.years.series[0].end ?? 0
        expect(reads.every((action) => (action.index ?? 0) >= firstYearEnd)).toBe(true)
    })
})

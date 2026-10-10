import { describe, expect, it } from 'vitest'
import { Side } from '../components/pieces.js'
import { MachineState } from './states.js'
import { TestGame } from '../testing/harness.js'
import { ActionType } from './actions.js'

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
        expect(game.state.round).toBe(1)
        expect(game.activePlayerId).toBe(game.playerOf(Side.Allied))
    })
})

import { describe, expect, it } from 'vitest'
import { Deconstruct, HydratedDeconstruct } from './deconstruct.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'
import { MachineState } from '../definition/states.js'
import { Ring } from '../utils/solGraph.js'

const INNER = { row: Ring.Convective, col: 2 }
const OUTER = { row: Ring.Inner, col: 2 }

// The rulebook: "If you begin your turn with no sundivers in the hold of your
// mothership or on the board, you must deconstruct one of your stations or one of
// your gates before you take your turn."
function setupStrandedPlayerWithOnlyAGate() {
    const state = createTestGameState()
    state.machineState = MachineState.StartOfTurn
    const player = state.players[0]
    player.addSundiversToReserve(player.removeSundiversFromHold(player.numSundiversInHold()))
    const gate = player.removeSolarGate()
    state.board.addGateAt(gate, INNER, OUTER)
    return { state, player, gate }
}

describe('Deconstruct', () => {
    it('lets a player with only gates on the board deconstruct one', () => {
        const { state, player } = setupStrandedPlayerWithOnlyAGate()

        expect(HydratedDeconstruct.canDeconstruct(state, player.playerId)).toBe(true)
        expect(HydratedDeconstruct.canDeconstructGateAt(state, player.playerId, INNER, OUTER)).toBe(
            true
        )
    })

    it('returns the gate to the reserve and puts 2 sundivers in the hold', () => {
        const { state, player, gate } = setupStrandedPlayerWithOnlyAGate()
        const gatesBefore = player.solarGates.length
        const movementBefore = player.movement

        const action = new HydratedDeconstruct({
            ...createActionBase(Deconstruct, state),
            playerId: player.playerId,
            coords: OUTER,
            innerCoords: INNER
        })
        action.apply(state)

        expect(state.board.hasGateBetween(INNER, OUTER)).toBe(false)
        expect(player.solarGates).toHaveLength(gatesBefore + 1)
        expect(player.solarGates.at(-1)?.id).toBe(gate.id)
        expect(player.solarGates.at(-1)?.innerCoords).toBeUndefined()
        expect(player.numSundiversInHold()).toBe(2)
        expect(player.movement).toBe(movementBefore)
        expect(action.metadata?.removedGate?.id).toBe(gate.id)
        expect(action.metadata?.removedStation).toBeUndefined()
    })

    it("refuses another player's gate", () => {
        const { state, gate } = setupStrandedPlayerWithOnlyAGate()
        const other = state.players[1]

        expect(HydratedDeconstruct.canDeconstructGateAt(state, other.playerId, INNER, OUTER)).toBe(
            false
        )
        const action = new HydratedDeconstruct({
            ...createActionBase(Deconstruct, state),
            playerId: other.playerId,
            coords: OUTER,
            innerCoords: INNER
        })
        expect(() => action.apply(state)).toThrow('Invalid deconstruct')
        expect(state.board.hasGateBetween(INNER, OUTER)).toBe(true)
        expect(gate.playerId).not.toBe(other.playerId)
    })
})

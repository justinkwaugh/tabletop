import { describe, expect, it } from 'vitest'
import { createTestGameState } from '../utils/testUtils.js'
import { HydratedActivateBonus } from './activateBonus.js'
import { EffectType } from '../components/effects.js'
import { StationType } from '../components/stations.js'
import { MachineState } from '../definition/states.js'

describe('HydratedActivateBonus.canActivateBonus', () => {
    it('is false for other players while the turn player has no current station', () => {
        const state = createTestGameState()
        const [turnPlayer, otherPlayer] = state.players
        state.turnManager.startTurn(turnPlayer.playerId)

        // Synchronize, after the turn player took the bonus at their first station.
        state.machineState = MachineState.Activating
        state.activeEffect = EffectType.Synchronize
        state.activations = [
            {
                playerId: turnPlayer.playerId,
                activatedIds: ['first-station'],
                stationType: StationType.EnergyNode
            }
        ]

        expect(HydratedActivateBonus.canActivateBonus(state, otherPlayer.playerId)).toBe(false)
    })
})

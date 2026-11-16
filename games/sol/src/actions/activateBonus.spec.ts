import { describe, expect, it } from 'vitest'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'
import { ActivateBonus, HydratedActivateBonus } from './activateBonus.js'
import { EffectType } from '../components/effects.js'
import { StationType } from '../components/stations.js'
import { MachineState } from '../definition/states.js'

function betweenSynchronizeStations() {
    const state = createTestGameState()
    const [turnPlayer, otherPlayer] = state.players
    state.turnManager.startTurn(turnPlayer.playerId)
    state.machineState = MachineState.Activating
    state.activeEffect = EffectType.Synchronize
    state.activations = [
        {
            playerId: turnPlayer.playerId,
            activatedIds: ['first-station'],
            stationType: StationType.EnergyNode
        }
    ]
    return { state, otherPlayer }
}

describe('ActivateBonus between Synchronize stations', () => {
    it('is not offered to other players', () => {
        const { state, otherPlayer } = betweenSynchronizeStations()

        expect(HydratedActivateBonus.canActivateBonus(state, otherPlayer.playerId)).toBe(false)
    })

    it('is not a valid bonus activation', () => {
        const { state, otherPlayer } = betweenSynchronizeStations()
        const bonus = createActionBase(ActivateBonus, state, { playerId: otherPlayer.playerId })

        expect(HydratedActivateBonus.isValidBonusActivation(state, bonus)).toBe(false)
    })
})

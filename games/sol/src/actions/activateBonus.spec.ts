import { describe, expect, it } from 'vitest'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'
import { ActivateBonus, HydratedActivateBonus } from './activateBonus.js'
import { EffectType } from '../components/effects.js'
import { StationType } from '../components/stations.js'
import { MachineState } from '../definition/states.js'
import { Ring } from '../utils/solGraph.js'
import type { HydratedSolGameState } from '../model/gameState.js'

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

function activatingOtherPlayersFoundryWithDuplicate() {
    const state = createTestGameState()
    const [turnPlayer, stationOwner] = state.players
    const foundry = stationOwner.sundiverFoundries.pop()
    if (!foundry) {
        throw new Error('Player has no sundiver foundries')
    }
    const coords = { row: Ring.Inner, col: 0 }
    state.board.addStationAt(foundry, coords)
    state.turnManager.startTurn(turnPlayer.playerId)
    state.machineState = MachineState.Activating
    state.activeEffect = EffectType.Duplicate
    state.activations = [
        {
            playerId: turnPlayer.playerId,
            activatedIds: [foundry.id],
            stationType: StationType.SundiverFoundry,
            currentStationId: foundry.id,
            currentStationCoords: coords
        }
    ]
    return { state, turnPlayer, stationOwner }
}

function applyBonus(state: HydratedSolGameState, playerId: string) {
    const bonus = new HydratedActivateBonus(createActionBase(ActivateBonus, state, { playerId }))
    bonus.apply(state)
    return bonus
}

describe('ActivateBonus at a foundry on a Duplicate turn', () => {
    it('doubles the build of the player who played Duplicate', () => {
        const { state, turnPlayer } = activatingOtherPlayersFoundryWithDuplicate()

        const bonus = applyBonus(state, turnPlayer.playerId)

        expect(bonus.metadata?.createdSundiverIds).toHaveLength(2)
    })

    it('builds the normal number of sundivers for the station owner', () => {
        const { state, stationOwner } = activatingOtherPlayersFoundryWithDuplicate()

        const bonus = applyBonus(state, stationOwner.playerId)

        expect(bonus.metadata?.createdSundiverIds).toHaveLength(1)
    })

    it('requires the doubled build in reserve only from the player who played Duplicate', () => {
        const { state, turnPlayer, stationOwner } = activatingOtherPlayersFoundryWithDuplicate()
        turnPlayer.reserveSundivers.splice(1)
        stationOwner.reserveSundivers.splice(1)

        expect(HydratedActivateBonus.canActivateBonus(state, turnPlayer.playerId)).toBe(false)
        expect(HydratedActivateBonus.canActivateBonus(state, stationOwner.playerId)).toBe(true)
    })
})

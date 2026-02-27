import { assert, assertExists } from '@tabletop/common'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'

export function resolvePostOperationsState(state: HydratedIndonesiaGameState): MachineState {
    if (state.shouldStartNewEra()) {
        state.incrementEra()
        return MachineState.NewEra
    }

    return MachineState.BiddingForTurnOrder
}

export function finishOperatingCompany(state: HydratedIndonesiaGameState): MachineState {
    const currentPhase = state.phaseManager.currentPhase
    assertExists(currentPhase, 'Current phase should exist while finishing company operation')
    assert(
        currentPhase.name === PhaseName.Operations,
        `Expected operations phase while finishing company operation, received ${currentPhase.name}`
    )

    state.markOperatingCompanyAsOperated()
    state.turnManager.endTurn(state.actionCount)

    const playersWhoCanOperate = state.turnManager.turnOrder.filter((playerId) =>
        state.canPlayerOperateAnyCompany(playerId)
    )
    if (playersWhoCanOperate.length === 0) {
        state.phaseManager.endPhase(state.actionCount)
        state.activePlayerIds = []
        if (state.canAnyCityGrow()) {
            return MachineState.CityGrowth
        }
        return resolvePostOperationsState(state)
    }

    return MachineState.Operations
}

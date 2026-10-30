import { assert, assertExists, type MachineContext } from '@tabletop/common'
import { Era } from '../definition/eras.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { deedsEndEra, HydratedIndonesiaGameState } from '../model/gameState.js'
import { HydratedStartCompany } from '../actions/startCompany.js'
import { queueRemovalForUnstartableAvailableDeeds } from '../operations/deedAvailability.js'

export function shouldStartNewEraAfterRemovingUnstartableDeeds(
    state: HydratedIndonesiaGameState
): boolean {
    return deedsEndEra(
        state.availableDeeds.filter((deed) => HydratedStartCompany.canDeedBeStarted(state, deed.id))
    )
}

export function resolvePostOperationsState(
    state: HydratedIndonesiaGameState,
    context?: MachineContext<HydratedIndonesiaGameState>
): MachineState {
    const shouldStartNewEra = shouldStartNewEraAfterRemovingUnstartableDeeds(state)
    const payoutMultiplier = shouldStartNewEra && state.era === Era.C ? 2 : 1
    state.settleOperationsIncomeToCash(payoutMultiplier)
    if (shouldStartNewEra && state.era === Era.C) {
        return MachineState.EndOfGame
    }

    queueRemovalForUnstartableAvailableDeeds(state, context)

    if (shouldStartNewEra) {
        state.incrementEra()
        return MachineState.NewEra
    }

    return MachineState.BiddingForTurnOrder
}

export function resolvePostMergersState(state: HydratedIndonesiaGameState): MachineState {
    const anyPlayerCanStartCompany = state.turnManager.turnOrder.some((playerId) =>
        HydratedStartCompany.canStartCompany(state, playerId)
    )
    if (!anyPlayerCanStartCompany) {
        return MachineState.ResearchAndDevelopment
    }

    return MachineState.Acquisitions
}

export function finishOperatingCompany(
    state: HydratedIndonesiaGameState,
    context?: MachineContext<HydratedIndonesiaGameState>
): MachineState {
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
        state.clearOperationsPhaseCompanyTracking()
        const anyCityCanGrow = state.canAnyCityGrow()
        state.phaseManager.endPhase(state.actionCount)
        state.activePlayerIds = []
        if (anyCityCanGrow) {
            return MachineState.CityGrowth
        }

        state.resetCityDemandsForOperationsPhase()
        return resolvePostOperationsState(state, context)
    }

    return MachineState.Operations
}

import { assert, assertExists, type MachineContext } from '@tabletop/common'
import { CompanyType } from '../definition/companyType.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { HydratedStartCompany } from '../actions/startCompany.js'
import { queueRemovalForUnstartableAvailableDeeds } from '../operations/deedAvailability.js'

function shouldStartNewEraAfterRemovingUnstartableDeeds(state: HydratedIndonesiaGameState): boolean {
    const startableDeeds = state.availableDeeds.filter((deed) =>
        HydratedStartCompany.canDeedBeStarted(state, deed.id)
    )

    if (startableDeeds.length === 0) {
        return true
    }

    const allShipping = startableDeeds.every((deed) => deed.type === CompanyType.Shipping)
    if (allShipping) {
        return true
    }

    const productionDeeds = startableDeeds.filter((deed) => deed.type === CompanyType.Production)
    if (productionDeeds.length !== startableDeeds.length) {
        return false
    }

    const firstGood = productionDeeds[0]?.good
    if (!firstGood) {
        return false
    }

    return productionDeeds.every((deed) => deed.good === firstGood)
}

export function resolvePostOperationsState(
    state: HydratedIndonesiaGameState,
    context?: MachineContext<HydratedIndonesiaGameState>
): MachineState {
    queueRemovalForUnstartableAvailableDeeds(state, context)

    if (shouldStartNewEraAfterRemovingUnstartableDeeds(state)) {
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
        state.settleOperationsIncomeToCash()
        state.phaseManager.endPhase(state.actionCount)
        state.activePlayerIds = []
        if (state.canAnyCityGrow()) {
            return MachineState.CityGrowth
        }
        return resolvePostOperationsState(state, context)
    }

    return MachineState.Operations
}

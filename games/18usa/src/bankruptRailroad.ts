import { closePrivate, type CompanyFormation, type TrainPurchaseState } from '@tabletop/18xx'
import type { EighteenUSAState } from './state.js'
import { BankruptRailroadId } from './privateHolders.js'
import { BankruptRailroadTrain, EighteenUSAPhases } from './trains.js'

/**
 * P29 starting a company in a city dealt a "No subsidy" tile gives it a 2-train, at any time
 * before the 2-trains rust (P29; BGG ruling PR-29b); the private closes with its contribution.
 */
export function grantBankruptRailroadTrain(
    state: TrainPurchaseState & EighteenUSAState,
    formation: CompanyFormation
): void {
    if (!formation.privateIds.includes(BankruptRailroadId)) return
    closePrivate(state, BankruptRailroadId)
    if (
        !state.noSubsidyCityIds.includes(formation.home.locationId) ||
        EighteenUSAPhases.rustTiming(state.phaseId, BankruptRailroadTrain.definitionId)
    )
        return
    state.trainInventory.trains.push({
        ...BankruptRailroadTrain,
        status: 'owned',
        owner: { kind: 'company', companyId: formation.companyId }
    })
}

import { assert } from '@tabletop/common'
import { prepareFinalOperatingTurn, type HydratedFinanceExampleState } from '@tabletop/18xx'
import { TheOldPrinceTrainDepot } from './trains.js'
export function prepareTheOldPrinceEnding(state: HydratedFinanceExampleState): void {
    state.phaseId = 'D'
    state.trainInventory = TheOldPrinceTrainDepot.createInventory()
    const train = TheOldPrinceTrainDepot.nextTrain(state.trainInventory, 'D')
    assert(
        train && state.trainPurchaseStep && state.operatingSet,
        'Final turn requires its train and operator'
    )
    TheOldPrinceTrainDepot.purchase(state.trainInventory, train.id, 'D', {
        kind: 'company',
        companyId: state.trainPurchaseStep.companyId
    })
    state.gameEnding = { reason: 'First diesel', finalOperatingSet: 2 }
    state.operatingSet.roundCount = 3
    prepareFinalOperatingTurn(state)
}

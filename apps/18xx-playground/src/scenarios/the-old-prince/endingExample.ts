import { assert } from '@tabletop/common'
import type { HydratedEighteenXXState } from '@tabletop/18xx'
import { prepareFinalOperatingTurn } from '../finalOperatingTurn.js'
import { TheOldPrinceTrainDepot } from '@tabletop/the-old-prince'
export function prepareTheOldPrinceEnding(state: HydratedEighteenXXState): void {
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

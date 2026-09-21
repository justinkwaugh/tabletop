import { setStagedSelectionValue, popHighestManualStagedSelection, type StagedSelectionState } from '@tabletop/frontend-components'
import type { PurchaseOfferRequest } from '@tabletop/18xx'
export type TrainSource = 'depot' | 'mine' | 'others'
type Stages = { source: TrainSource; purchase: PurchaseOfferRequest }
const Order = ['source', 'purchase'] as const
export type TrainBuyingSelection = StagedSelectionState<Stages>
export function chooseTrainSource(source: TrainSource): TrainBuyingSelection {
    return setStagedSelectionValue<Stages, 'source'>({}, Order, 'source', source, 'manual')
}
export function chooseCompanyTrain(selection: TrainBuyingSelection, purchase: PurchaseOfferRequest): TrainBuyingSelection {
    return setStagedSelectionValue(selection, Order, 'purchase', purchase, 'manual')
}
export function backFromTrainBuying(selection: TrainBuyingSelection): TrainBuyingSelection {
    return popHighestManualStagedSelection(selection, Order).nextState
}

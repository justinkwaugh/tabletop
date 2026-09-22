import { isOperatingStep } from '../operating/operatingSteps.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import type { TransferRules } from '../transfers/purchaseOffer.js'

export const EighteenXXTransferTiming: Pick<TransferRules, 'operatingCompany' | 'canPurchase'> = {
    operatingCompany(state) {
        return isOperatingStep(state.machineState) ? nextOperatingCompany(state) : undefined
    },
    canPurchase(state, companyId, asset) {
        return (
            asset.kind === 'private' ||
            (state.machineState === 'BuyingTrains' &&
                state.trainPurchaseStep?.companyId === companyId)
        )
    }
}

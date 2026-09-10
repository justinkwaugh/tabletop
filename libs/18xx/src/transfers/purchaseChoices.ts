import {
    assetOwner,
    evaluatePurchaseOffer,
    operatingCompany,
    type PurchaseAsset,
    type PurchaseOfferRequest,
    type TransferRules
} from './purchaseOffer.js'
import { controllingOwner } from '../finance/finance.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { pendingCompanyDecision, type CompanyDecisionState } from '../privates/companyDecision.js'
export function purchaseChoices(
    state: CompanyDecisionState,
    playerId: string,
    rules: TransferRules,
    trains: TrainRules
): { request: PurchaseOfferRequest; minimum: number; maximum?: number }[] {
    const companyId = operatingCompany(state)
    if (
        !companyId ||
        pendingCompanyDecision(state) ||
        controllingOwner(state, companyId)?.playerId !== playerId
    )
        return []
    const assets: PurchaseAsset[] = [
        ...state.trainInventory.trains.map(
            (train) => ({ kind: 'train', trainId: train.id }) as const
        ),
        ...state.companies
            .filter((company) => company.kind === 'private')
            .map((company) => ({ kind: 'private', privateCompanyId: company.id }) as const)
    ]
    return assets.flatMap((asset) => {
        const seller = assetOwner(state, asset)
        const range = rules.priceRange(state, companyId, asset)
        if (!seller || !range) return []
        const request = { companyId, asset, seller, price: range.minimum }
        return evaluatePurchaseOffer(state, request, rules, trains).reason
            ? []
            : [{ request, ...range }]
    })
}

import type { CompanyCharters } from '../company/companyCharters.js'
import { privateOwner } from '../finance/finance.js'
import { EighteenXXTransferTiming } from '../game/transferTiming.js'
import type { TransferRules } from './purchaseOffer.js'

/**
 * Transfers in a title whose national company never trades (1861 §7.1, §10.10; 1867 GTG §3.1,
 * §8.11, §8.12): companies trade trains at any price of at least one, but never with the
 * national company; in some phases a company buys a player's private for one up to its face
 * value.
 */
export function nationalCompanyTransfers(options: {
    charters: CompanyCharters
    nationalId: string
    privatePurchasePhaseIds: readonly string[]
    privateFaceValue(privateId: string): number
}): TransferRules {
    const { charters, nationalId, privatePurchasePhaseIds, privateFaceValue } = options
    return {
        ...EighteenXXTransferTiming,
        charters,
        canPurchase(state, companyId, asset) {
            if (companyId === nationalId) return false
            if (asset.kind === 'train') {
                const train = state.trainInventory.trains.find(
                    (entry) => entry.id === asset.trainId
                )
                if (
                    train?.status === 'owned' &&
                    train.owner.kind === 'company' &&
                    train.owner.companyId === nationalId
                )
                    return false
            }
            return EighteenXXTransferTiming.canPurchase(state, companyId, asset)
        },
        priceRange(state, _companyId, asset) {
            if (asset.kind === 'train') return { minimum: 1 }
            if (asset.kind !== 'private') return undefined
            if (!privatePurchasePhaseIds.includes(state.phaseId)) return undefined
            if (privateOwner(state, asset.privateCompanyId)?.kind !== 'player') return undefined
            return { minimum: 1, maximum: privateFaceValue(asset.privateCompanyId) }
        },
        afterPurchase: () => undefined
    }
}

import { EighteenThirtyTwoMarket } from './stockMarket.js'
import { assertExists } from '@tabletop/common'
import {
    getCompany,
    sameOwner,
    sharesOwned,
    type Owner,
    type ShareSaleDetails,
    type SharePurchaseDetails,
    type StockState
} from '@tabletop/18xx'

export const OwnershipPercent = 60
const OwnershipFreeColors: readonly string[] = ['green', 'brown']

function ownershipCeiling(state: StockState, companyId: string): number {
    const shareCount = getCompany(state, companyId).shareCount
    assertExists(shareCount, 'Ownership limits require a share count')
    return Math.floor((OwnershipPercent * shareCount) / 100)
}

/**
 * A player above 60% of a company keeps the excess until they next sell its shares (§5.4.1,
 * §5.9.8); the family's ownership exemptions record it. The list is replaced rather than changed
 * in place, as sale hooks may run on a shallow copy of the state.
 */
export function refreshOwnershipExcess(state: StockState, companyId: string, owner: Owner): void {
    if (owner.kind !== 'player') return
    const exemptions = state.ownershipLimitExemptions
    assertExists(exemptions, '1832 records ownership exemptions')
    const held = sharesOwned(state, companyId, owner)
    state.ownershipLimitExemptions = [
        ...exemptions.filter(
            (exemption) => exemption.companyId !== companyId || !sameOwner(exemption.owner, owner)
        ),
        ...(held > ownershipCeiling(state, companyId)
            ? [{ owner, companyId, maximumShares: held }]
            : [])
    ]
}

/**
 * Selling a company held above 60% outside the green and brown areas, the seller must sell down
 * to 60% in that block (§5.9.8).
 */
export function requiredSellDown(state: StockState, companyId: string, seller: Owner): number {
    if (
        OwnershipFreeColors.includes(
            EighteenThirtyTwoMarket.companySpace(state.stockMarket, companyId).color
        )
    )
        return 0
    return Math.max(0, sharesOwned(state, companyId, seller) - ownershipCeiling(state, companyId))
}

export function refreshSellerExcess(state: StockState, details: ShareSaleDetails): void {
    for (const sale of details.sales) refreshOwnershipExcess(state, sale.companyId, details.seller)
}

export function refreshBuyerExcess(state: StockState, details: SharePurchaseDetails): void {
    refreshOwnershipExcess(state, details.companyId, details.buyer)
}

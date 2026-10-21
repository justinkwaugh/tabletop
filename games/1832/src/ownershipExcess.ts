import { EighteenThirtyTwoCharters } from './charters.js'
import { EighteenThirtyTwoMarket } from './stockMarket.js'
import { assertExists } from '@tabletop/common'
import {
    companyShareCount,
    sharesOwned,
    type Owner,
    type StockRules,
    type StockState
} from '@tabletop/18xx'

export const OwnershipPercent = 60
const OwnershipFreeColors: readonly string[] = ['green', 'brown']

function shareCountOf(state: StockState, companyId: string): number {
    const shareCount = companyShareCount(state, EighteenThirtyTwoCharters, companyId)
    assertExists(shareCount, 'Ownership limits require a share count')
    return shareCount
}

/** The most shares of a company a player may hold outside the green and brown areas. */
export function ownershipCeiling(state: StockState, companyId: string): number {
    return Math.floor((OwnershipPercent * shareCountOf(state, companyId)) / 100)
}

/**
 * A player above 60% of a company, through protection or a merger, keeps the excess until they
 * next sell its shares, but may not add to it (§5.4.1, §5.9.8): the limit is what they hold.
 */
export function withHeldExcess(
    ownershipLimit: StockRules['ownershipLimit']
): StockRules['ownershipLimit'] {
    return (state, companyId, owner) => {
        const limit = ownershipLimit(state, companyId, owner)
        if (owner.kind !== 'player') return limit
        const shareCount = companyShareCount(state, EighteenThirtyTwoCharters, companyId)
        if (!shareCount) return limit
        return Math.max(limit, (sharesOwned(state, companyId, owner) * 100) / shareCount)
    }
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

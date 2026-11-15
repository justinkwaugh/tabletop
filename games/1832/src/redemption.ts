import {
    ShareRedemptionProcedure,
    getCompany,
    type RedemptionChoice,
    type ReissueChoice,
    type SharePurchaseDetails,
    type StockState
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { EighteenThirtyTwoCharters } from './charters.js'
import {
    requireEighteenThirtyTwoState,
    type EighteenThirtyTwoStateHandler,
    type HydratedEighteenThirtyTwoState
} from './state.js'
import { EighteenThirtyTwoStockRules } from './stockRules.js'
import { EighteenThirtyTwoStockRoundRules } from './roundRules.js'
import { MaximumReissuePar, ReissueParPrices, EighteenThirtyTwoMarket } from './stockMarket.js'
import { isSystem } from './systems.js'

/**
 * The par price reissued shares sell at: the higher of the company's par and the reissue par
 * nearest 75% of its market price, a tie rounding up (§5.11).
 */
export function reissueParPrice(state: HydratedEighteenThirtyTwoState, companyId: string): number {
    const target =
        (EighteenThirtyTwoMarket.companySpace(state.stockMarket, companyId).price * 3) / 4
    const nearest = ReissueParPrices.reduce((best, price) =>
        Math.abs(price - target) <= Math.abs(best - target) ? price : best
    )
    const parPrice = getCompany(state, companyId).parPrice
    assertExists(parPrice, 'A reissuing company has a par price')
    return Math.min(MaximumReissuePar, Math.max(parPrice, nearest))
}

// A capitalized company redeems one share a stock round, a System two, one a turn, keeping at most
// 40% (§5.10, §11.6.9); once its original offering has sold out it reissues them (§5.11).
export const EighteenThirtyTwoRedemption =
    new ShareRedemptionProcedure<HydratedEighteenThirtyTwoState>({
        market: EighteenThirtyTwoMarket,
        charters: EighteenThirtyTwoCharters,
        roundRules: EighteenThirtyTwoStockRoundRules,
        stockRules: () => EighteenThirtyTwoStockRules,
        requireState: requireEighteenThirtyTwoState,
        mayRedeem: (company) => !!company.funded,
        redemptionsPerRound: (state, companyId) => (isSystem(state, companyId) ? 2 : 1),
        reissueParPrice,
        reissueNeedsEmptyOffering: false
    })

export function spendableCash(state: HydratedEighteenThirtyTwoState, companyId: string): number {
    return EighteenThirtyTwoRedemption.spendableCash(state, companyId)
}

export function redemptionChoices(
    state: HydratedEighteenThirtyTwoState,
    playerId: string
): RedemptionChoice[] {
    return EighteenThirtyTwoRedemption.redemptionChoices(state, playerId)
}

export function reissueChoices(
    state: HydratedEighteenThirtyTwoState,
    playerId: string
): ReissueChoice[] {
    return EighteenThirtyTwoRedemption.reissueChoices(state, playerId)
}

export function isReissuedShare(state: StockState, companyId: string, poolId?: string): boolean {
    return EighteenThirtyTwoRedemption.isReissuedShare(state, companyId, poolId)
}

export function lockReissueProceeds(state: StockState, details: SharePurchaseDetails): void {
    EighteenThirtyTwoRedemption.lockProceeds(state, details)
}

export function redeemsAndReissues(
    handler: EighteenThirtyTwoStateHandler
): EighteenThirtyTwoStateHandler {
    return EighteenThirtyTwoRedemption.redeemsAndReissues(handler)
}

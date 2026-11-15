import {
    PriceProtectionProcedure,
    type Owner,
    type ShareSaleDetails,
    type ShareSaleSettlement,
    type StockState
} from '@tabletop/18xx'
import {
    requireEighteenThirtyTwoState,
    type EighteenThirtyTwoStateHandler,
    type HydratedEighteenThirtyTwoState
} from './state.js'
import { ownershipCeiling } from './ownershipExcess.js'
import { EighteenThirtyTwoOperatingRules } from './roundRules.js'
import { EighteenThirtyTwoStockRules } from './stockRules.js'
import { EighteenThirtyTwoLedgeMarket } from './stockMarket.js'
import { MergingState } from './titleState.js'

// A president other than the seller may buy back a sale once the seller finishes, including one
// who gained the presidency by that sale (§5.9); a takeover's funding sales wait for it too.
export const EighteenThirtyTwoPriceProtection =
    new PriceProtectionProcedure<HydratedEighteenThirtyTwoState>({
        market: EighteenThirtyTwoLedgeMarket,
        stockRules: () => EighteenThirtyTwoStockRules,
        companyOrder: (state) => EighteenThirtyTwoOperatingRules.companyOrder(state),
        requireState: requireEighteenThirtyTwoState,
        ownershipCeiling,
        newPresidentProtects: true,
        sellerStillRaising: (state) => !!state.mergerPhase?.funding,
        resumesWithoutPlayers: [MergingState]
    })

export function protectionDecision(state: HydratedEighteenThirtyTwoState) {
    return EighteenThirtyTwoPriceProtection.decision(state)
}

export function protectable(
    state: HydratedEighteenThirtyTwoState,
    sale: Parameters<typeof EighteenThirtyTwoPriceProtection.protectable>[1]
): boolean {
    return EighteenThirtyTwoPriceProtection.protectable(state, sale)
}

export function declinedMarketSpaceId(
    state: StockState,
    sale: Parameters<typeof EighteenThirtyTwoPriceProtection.declinedMarketSpaceId>[1]
): string {
    return EighteenThirtyTwoPriceProtection.declinedMarketSpaceId(state, sale)
}

export function holdsProtectableMove(
    state: StockState,
    sale: Pick<ShareSaleSettlement, 'companyId' | 'presidency'>,
    seller: Owner
): boolean {
    return EighteenThirtyTwoPriceProtection.holdsMove(state, sale, seller)
}

export function recordProtectableSale(state: object, details: ShareSaleDetails): void {
    EighteenThirtyTwoPriceProtection.recordSale(state, details)
}

export function sellerLimitState<State extends StockState>(state: State, owner: Owner): State {
    return EighteenThirtyTwoPriceProtection.sellerLimitState(state, owner)
}

export function startsPriceProtection(
    handler: EighteenThirtyTwoStateHandler
): EighteenThirtyTwoStateHandler {
    return EighteenThirtyTwoPriceProtection.starts(handler)
}

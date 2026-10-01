import * as Type from 'typebox'
import type { StockState } from './stockState.js'
import type { StockRules } from './stockRules.js'
import type { ShareCertificate } from './sharePurchase.js'

export const StockTurnPurchase = Type.Object(
    {
        kind: Type.Union([Type.Literal('share'), Type.Literal('start'), Type.Literal('private')]),
        companyId: Type.String(),
        poolId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type StockTurnPurchase = Type.Static<typeof StockTurnPurchase>

/**
 * State fields a title adds with ``StockRules.multipleBuys``. They stay out of the family state
 * until titles in play can take a state migration.
 */
export const StockTurnPurchaseFields = {
    stockTurnPurchases: Type.Optional(Type.Array(StockTurnPurchase))
}
export type StockTurnPurchaseState = { stockTurnPurchases?: StockTurnPurchase[] }

export interface MultipleBuyRules {
    /**
     * Whether a further share of the company may follow the turn's earlier purchases, which the
     * family has already limited to that company's shares and privates.
     */
    allowsAnother(
        state: StockState,
        certificate: ShareCertificate,
        earlier: readonly StockTurnPurchase[]
    ): boolean
}

export function furtherShareAllowed(
    state: StockState & StockTurnPurchaseState,
    certificate: ShareCertificate,
    rules: StockRules
): boolean {
    const earlier = state.stockTurnPurchases ?? []
    return (
        !!rules.multipleBuys &&
        earlier.every(
            (purchase) =>
                purchase.kind === 'private' ||
                (purchase.kind === 'share' && purchase.companyId === certificate.companyId)
        ) &&
        rules.multipleBuys.allowsAnother(state, certificate, earlier)
    )
}

export function recordTurnPurchase(
    state: StockState & StockTurnPurchaseState,
    rules: StockRules,
    purchase: StockTurnPurchase
): void {
    if (rules.multipleBuys) (state.stockTurnPurchases ??= []).push(purchase)
}

export function clearTurnPurchases(state: StockState & StockTurnPurchaseState): void {
    delete state.stockTurnPurchases
}

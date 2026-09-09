import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    Owner,
    copyFinances,
    cashOwnedBy,
    getCompany,
    sameOwner,
    sharesOwned,
    type Portfolio
} from '../finance/finance.js'
import type { StockState } from './stockState.js'
import { CashPayment } from '../finance/cashPayments.js'
import { PresidencyChange, evaluatePresidency } from './presidency.js'
import { stockCertificateCount, exceedsStockLimits, type StockRules } from './stockRules.js'

export type ShareCertificate = Extract<Portfolio[number], { kind: 'share' }>
export type PurchaseRequest = { playerId: string; buyer: Owner; certificateId: string }
export const SharePurchaseDetails = Type.Object(
    {
        certificateId: Type.String(),
        companyId: Type.String(),
        buyer: Owner,
        seller: Owner,
        price: Type.Integer({ minimum: 1 }),
        payments: Type.Array(CashPayment),
        presidency: Type.Optional(PresidencyChange)
    },
    { additionalProperties: false }
)
export type SharePurchaseDetails = Type.Static<typeof SharePurchaseDetails>
export type SharePurchaseResult =
    | { details: SharePurchaseDetails; reason?: never }
    | { details?: never; reason: string }
export type SharePurchaseTerms = { price: number; recipient: Owner; payers: Owner[] }
export function evaluateSharePurchase(
    state: StockState,
    request: PurchaseRequest,
    rules: StockRules
): SharePurchaseResult {
    const { playerId, buyer, certificateId } = request
    if (state.stockRound.turn.bought) return { reason: 'Only one purchase is allowed this turn.' }
    if (exceedsStockLimits(state, { kind: 'player', playerId }, rules))
        return { reason: 'Sell down to the stock limits before buying.' }
    if (!state.activePlayerIds.includes(playerId))
        return { reason: 'It is not this player’s turn.' }
    if (!rules.buyers(state, playerId).some((allowed) => sameOwner(allowed, buyer)))
        return { reason: 'This player cannot buy for that owner.' }
    const certificate = state.certificates.find((certificate) => certificate.id === certificateId)
    if (!certificate || certificate.retired || certificate.kind !== 'share')
        return { reason: 'This is not an available share certificate.' }
    if (sameOwner(certificate.owner, buyer))
        return { reason: 'The buyer already owns this certificate.' }
    if (
        state.stockRound.sales.some(
            (sale) => sameOwner(sale.owner, buyer) && sale.companyId === certificate.companyId
        )
    )
        return { reason: 'The buyer sold shares in this company this stock round.' }
    const terms = rules.purchaseTerms(state, certificate, buyer)
    if (typeof terms === 'string') return { reason: terms }
    const company = getCompany(state, certificate.companyId)
    assertExists(company.shareCount, 'Priced shares require a share count')
    if (
        (sharesOwned(state, company.id, buyer) + certificate.shares) * 100 >
        rules.ownershipLimit(state, company.id, buyer) * company.shareCount
    )
        return { reason: 'The purchase exceeds the ownership limit.' }
    if (
        stockCertificateCount(state, buyer, rules) + rules.certificateWeight(state, certificate) >
        rules.certificateLimit(state, buyer)
    )
        return { reason: 'The purchase exceeds the certificate limit.' }
    assert(
        Number.isSafeInteger(terms.price) && terms.price > 0,
        'Purchase price must be a positive integer'
    )
    assertExists(cashOwnedBy(state, terms.recipient), 'Purchase recipient requires cash')
    let remaining = terms.price
    const payments: CashPayment[] = []
    for (const [index, payer] of terms.payers.entries()) {
        assert(
            !terms.payers.slice(0, index).some((other) => sameOwner(other, payer)),
            'Duplicate purchase payer'
        )
        const cash = cashOwnedBy(state, payer)
        assertExists(cash, 'Purchase payer requires cash')
        const amount = cash === 'unlimited' ? remaining : Math.min(cash, remaining)
        if (amount > 0) payments.push({ from: payer, to: terms.recipient, amount })
        remaining -= amount
    }
    if (remaining > 0) return { reason: 'The buyer cannot afford this purchase.' }
    const projected = copyFinances(state)
    const purchased = projected.certificates.find((item) => item.id === certificateId)
    assert(purchased && !purchased.retired, 'Missing purchased certificate')
    purchased.owner = buyer
    delete purchased.poolId
    const presidency = evaluatePresidency(
        projected,
        company.id,
        rules.presidencyCandidates(state, company.id)
    )
    if (presidency.reason) return { reason: presidency.reason }
    return {
        details: {
            certificateId,
            companyId: certificate.companyId,
            buyer,
            seller: certificate.owner,
            price: terms.price,
            payments,
            ...(presidency.change ? { presidency: presidency.change } : {})
        }
    }
}

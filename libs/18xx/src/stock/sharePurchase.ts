import * as Type from 'typebox'
import { openShorts, retireCertificates } from './shorts.js'
import { furtherShareAllowed } from './turnPurchases.js'
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
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import {
    PresidencyChange,
    PresidencyClaim,
    evaluatePresidency,
    applyPresidencyChange,
    applyPresidencyClaim
} from './presidency.js'
import {
    certificateLimitAllows,
    stockCertificateCount,
    purchaseOwnershipCeiling,
    type StockRules
} from './stockRules.js'
import { mustSellShares } from './shareSale.js'

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
        presidency: Type.Optional(PresidencyChange),
        presidencyClaim: Type.Optional(PresidencyClaim),
        coveredShortId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type SharePurchaseDetails = Type.Static<typeof SharePurchaseDetails>
export type SharePurchaseResult =
    { details: SharePurchaseDetails; reason?: never } | { details?: never; reason: string }
export type ShareBuyResult =
    | { details: SharePurchaseDetails; poolId?: string; reason?: never }
    | { details?: never; reason: string }
export type SharePurchaseTerms = { price: number; recipient: Owner; payers: Owner[] }
export function evaluateSharePurchase(
    state: StockState,
    request: PurchaseRequest,
    rules: StockRules
): ShareBuyResult {
    const certificate = state.certificates.find((item) => item.id === request.certificateId)
    if (!certificate || certificate.retired || certificate.kind !== 'share')
        return { reason: 'This is not an available share certificate.' }
    if (state.stockRound.turn.bought && !furtherShareAllowed(state, certificate, rules))
        return { reason: 'Only one purchase is allowed this turn.' }
    const result = evaluateShareAcquisition(
        state,
        request,
        rules,
        rules.purchaseTerms(state, certificate, request.buyer)
    )
    return result.details && certificate.poolId ? { ...result, poolId: certificate.poolId } : result
}

export function evaluateShareAcquisition(
    state: StockState,
    request: PurchaseRequest,
    rules: StockRules,
    terms: SharePurchaseTerms | string
): SharePurchaseResult {
    const { playerId, buyer } = request
    if (mustSellShares(state, playerId, rules))
        return { reason: 'Sell down to the stock limits before buying.' }
    if (!state.activePlayerIds.includes(playerId))
        return { reason: 'It is not this player’s turn.' }
    if (!rules.buyers(state, playerId).some((allowed) => sameOwner(allowed, buyer)))
        return { reason: 'This player cannot buy for that owner.' }
    const transfer = evaluateShareTransfer(state, request, rules, terms)
    const companyId = transfer.details?.companyId
    if (
        state.stockRound.sales.some(
            (sale) => sameOwner(sale.owner, buyer) && sale.companyId === companyId
        )
    )
        return { reason: 'The buyer sold shares in this company this stock round.' }
    return transfer
}

export function evaluateShareTransfer(
    state: StockState,
    request: PurchaseRequest,
    rules: StockRules,
    terms: SharePurchaseTerms | string
): SharePurchaseResult {
    const { buyer, certificateId } = request
    const certificate = state.certificates.find((certificate) => certificate.id === certificateId)
    if (!certificate || certificate.retired || certificate.kind !== 'share')
        return { reason: 'This is not an available share certificate.' }
    if (sameOwner(certificate.owner, buyer))
        return { reason: 'The buyer already owns this certificate.' }
    if (typeof terms === 'string') return { reason: terms }
    const company = getCompany(state, certificate.companyId)
    assertExists(company.shareCount, 'Priced shares require a share count')
    // A share that closes the buyer's short leaves their holdings and certificates unchanged.
    const coveredShort = openShorts(state, company.id, buyer)[0]
    if (
        !coveredShort &&
        sharesOwned(state, company.id, buyer) + certificate.shares >
            purchaseOwnershipCeiling(state, company.id, buyer, rules)
    )
        return { reason: 'The purchase exceeds the ownership limit.' }
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
    const projected = { ...state, ...copyFinances(state) }
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
    if (presidency.claim) applyPresidencyClaim(projected, presidency.claim)
    if (
        !coveredShort &&
        !certificateLimitAllows(state, buyer, certificate, rules) &&
        !(
            presidency.claim &&
            stockCertificateCount(projected, buyer, rules) <=
                rules.certificateLimit(projected, buyer)
        )
    )
        return { reason: 'The purchase exceeds the certificate limit.' }
    return {
        details: {
            certificateId,
            companyId: certificate.companyId,
            buyer,
            seller: certificate.owner,
            price: terms.price,
            payments,
            ...(presidency.change ? { presidency: presidency.change } : {}),
            ...(presidency.claim ? { presidencyClaim: presidency.claim } : {}),
            ...(coveredShort ? { coveredShortId: coveredShort.id } : {})
        }
    }
}

export function applySharePurchase(state: StockState, details: SharePurchaseDetails): void {
    applyShareTransfer(state, details)
    if (details.buyer.kind === 'company')
        state.stockRound.companyPurchases.push(details.buyer.companyId)
    markTurnPurchase(state)
}

export function applyShareTransfer(state: StockState, details: SharePurchaseDetails): void {
    const certificate = state.certificates.find(
        (certificate) => certificate.id === details.certificateId
    )
    assert(certificate && !certificate.retired, 'Missing purchased certificate')
    settleCashPayments(state, details.payments)
    certificate.owner = details.buyer
    delete certificate.poolId
    if (details.presidency) applyPresidencyChange(state, details.presidency)
    if (details.presidencyClaim) applyPresidencyClaim(state, details.presidencyClaim)
    if (details.coveredShortId)
        retireCertificates(state, [details.certificateId, details.coveredShortId])
}

export function markTurnPurchase(state: StockState): void {
    state.stockRound.turn.soldBeforeBuying = state.stockRound.turn.companiesSold.length > 0
    state.stockRound.turn.bought = true
}

import * as Type from 'typebox'
import { assert, assertExists, type GameState } from '@tabletop/common'
import {
    Owner,
    cashOwnedBy,
    certificatesOwnedBy,
    countCertificatesForLimit,
    getCompany,
    sameOwner,
    sharesOwned,
    type FinancialState,
    type Portfolio
} from '../finance/finance.js'
import type { StockRound } from './stockRound.js'

export type SharePurchaseState = FinancialState &
    Pick<GameState, 'players' | 'activePlayerIds'> & { stockRound: StockRound }
export type ShareCertificate = Extract<Portfolio[number], { kind: 'share' }>
export type PurchaseRequest = { playerId: string; buyer: Owner; certificateId: string }
export const CashPayment = Type.Object(
    { from: Owner, to: Owner, amount: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type CashPayment = Type.Static<typeof CashPayment>
export const SharePurchaseDetails = Type.Object(
    {
        certificateId: Type.String(),
        companyId: Type.String(),
        buyer: Owner,
        seller: Owner,
        price: Type.Integer({ minimum: 1 }),
        payments: Type.Array(CashPayment)
    },
    { additionalProperties: false }
)
export type SharePurchaseDetails = Type.Static<typeof SharePurchaseDetails>
export type SharePurchaseResult =
    | { details: SharePurchaseDetails; reason?: never }
    | { details?: never; reason: string }
export type SharePurchaseTerms = { price: number; recipient: Owner; payers: Owner[] }
export interface SharePurchaseRules {
    buyers(state: SharePurchaseState, playerId: string): Owner[]
    terms(
        state: SharePurchaseState,
        certificate: ShareCertificate,
        buyer: Owner
    ): SharePurchaseTerms | string
    certificateLimit(state: SharePurchaseState, buyer: Owner): number
    ownershipLimit(state: SharePurchaseState, buyer: Owner): number
}

export function evaluateSharePurchase(
    state: SharePurchaseState,
    request: PurchaseRequest,
    rules: SharePurchaseRules
): SharePurchaseResult {
    const { playerId, buyer, certificateId } = request
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
    const terms = rules.terms(state, certificate, buyer)
    if (typeof terms === 'string') return { reason: terms }
    const company = getCompany(state, certificate.companyId)
    assertExists(company.shareCount, 'Priced shares require a share count')
    if (
        (sharesOwned(state, company.id, buyer) + certificate.shares) * 100 >
        rules.ownershipLimit(state, buyer) * company.shareCount
    )
        return { reason: 'The purchase exceeds the ownership limit.' }
    if (
        countCertificatesForLimit(certificatesOwnedBy(state, buyer)) +
            certificate.certificateLimitCount >
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
    return {
        details: {
            certificateId,
            companyId: certificate.companyId,
            buyer,
            seller: certificate.owner,
            price: terms.price,
            payments
        }
    }
}

export function existingSharePurchaseRestriction(
    state: FinancialState,
    certificate: ShareCertificate,
    buyer: Owner
): string | undefined {
    const company = getCompany(state, certificate.companyId)
    if (!company.floated) return 'Only floated companies are available in this example.'
    if (certificate.president) return 'Starting a presidency is not available in this example.'
    if (!company.president) return 'This company has no president.'
    if (
        !sameOwner(company.president, buyer) &&
        sharesOwned(state, company.id, buyer) + certificate.shares >
            sharesOwned(state, company.id, company.president)
    )
        return 'Presidency changes are not available in this example.'
    return undefined
}

export function settleCashPayments(
    state: Pick<FinancialState, 'cash'>,
    payments: readonly CashPayment[]
): void {
    const balances = new Map<FinancialState['cash'][number], number>()
    for (const payment of payments) {
        assert(
            Number.isSafeInteger(payment.amount) && payment.amount > 0,
            'Payment must be a positive integer'
        )
        for (const [owner, delta] of [
            [payment.from, -payment.amount],
            [payment.to, payment.amount]
        ] as const) {
            const cash = state.cash.find((cash) => sameOwner(cash.owner, owner))
            assertExists(cash, 'Payment requires an existing cash owner')
            if (cash.amount !== 'unlimited')
                balances.set(cash, (balances.get(cash) ?? cash.amount) + delta)
        }
    }
    for (const balance of balances.values())
        assert(Number.isSafeInteger(balance) && balance >= 0, 'Payment exceeds available cash')
    for (const [cash, balance] of balances) cash.amount = balance
}

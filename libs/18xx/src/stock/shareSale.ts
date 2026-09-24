import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    Owner,
    cashOwnedBy,
    certificatesOwnedBy,
    getCompany,
    sameOwner,
    sharesOwned
} from '../finance/finance.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import {
    PresidencyChange,
    evaluatePresidency,
    applyPresidencyChange,
    certificatesForShares
} from './presidency.js'
import { companyMarketSpace, moveMarketSpace, placeStockMarker } from './stockMarket.js'
import { copyStockState, type StockState } from './stockState.js'
import type { StockRules } from './stockRules.js'

export const ShareSale = Type.Object(
    { companyId: Type.String(), shares: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type ShareSale = Type.Static<typeof ShareSale>
export type SaleRequest = { playerId: string; seller: Owner; sales: ShareSale[] }
export const ShareSaleSettlement = Type.Object(
    {
        ...ShareSale.properties,
        certificateIds: Type.Array(Type.String()),
        destinationPoolId: Type.String(),
        price: Type.Integer({ minimum: 1 }),
        proceeds: Type.Integer({ minimum: 1 }),
        fromMarketSpaceId: Type.String(),
        toMarketSpaceId: Type.String(),
        presidency: Type.Optional(PresidencyChange)
    },
    { additionalProperties: false }
)
export type ShareSaleSettlement = Type.Static<typeof ShareSaleSettlement>
export const ShareSaleDetails = Type.Object(
    {
        seller: Owner,
        sales: Type.Array(ShareSaleSettlement),
        payments: Type.Array(CashPayment),
        proceeds: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type ShareSaleDetails = Type.Static<typeof ShareSaleDetails>
export type ShareSaleResult =
    | { details: ShareSaleDetails; reason?: never }
    | { details?: never; reason: string }

export function evaluateShareSale(
    state: StockState,
    request: SaleRequest,
    rules: StockRules
): ShareSaleResult {
    const { playerId, seller, sales } = request
    if (sales.length !== 1) return { reason: 'Sell one company per action.' }
    if (!state.activePlayerIds.includes(playerId))
        return { reason: 'It is not this player’s turn.' }
    if (!rules.sellers(state, playerId).some((owner) => sameOwner(owner, seller)))
        return { reason: 'This player cannot sell for that owner.' }
    const turn = state.stockRound.turn
    if (turn.bought && (!rules.sellAfterBuying || turn.soldBeforeBuying))
        return { reason: 'Selling is not allowed after this purchase.' }
    const previous = turn.saleBlocks?.find(
        (block) => block.companyId === sales[0].companyId && sameOwner(block.seller, seller)
    )
    if (turn.companiesSold.includes(sales[0].companyId) && (!rules.extendSaleBlocks || !previous))
        return { reason: 'Sell a company’s shares in one block per turn.' }
    if (!previous || !rules.extendSaleBlocks)
        return evaluateShareDisposal(state, seller, sales, rules)
    return evaluateShareDisposal(state, seller, sales, {
        presidencyCandidates: rules.presidencyCandidates,
        saleTerms(projected, companyId, shares, seller) {
            const terms = rules.saleTerms(projected, companyId, previous.shares + shares, seller)
            if (typeof terms === 'string') return terms
            assert(
                terms.direction === previous.direction,
                'An extended sale block must keep its movement direction'
            )
            return {
                ...terms,
                price: previous.price,
                maximumShares: terms.maximumShares - previous.shares,
                movement: Math.max(0, terms.movement - previous.movement)
            }
        }
    })
}

export function evaluateShareDisposal(
    state: StockState,
    seller: Owner,
    sales: ShareSale[],
    rules: Pick<StockRules, 'saleTerms' | 'presidencyCandidates'>
): ShareSaleResult {
    if (!sales.length || new Set(sales.map((sale) => sale.companyId)).size !== sales.length)
        return { reason: 'Choose one sale block for each company.' }
    const projected = copyStockState(state)
    const settlements: ShareSaleSettlement[] = []
    const payments: CashPayment[] = []
    for (const sale of sales) {
        if (!Number.isSafeInteger(sale.shares) || sale.shares <= 0)
            return { reason: 'Choose a positive number of shares.' }
        if (!state.companies.some((company) => company.id === sale.companyId))
            return { reason: 'Unknown company.' }
        const terms = rules.saleTerms(projected, sale.companyId, sale.shares, seller)
        if (typeof terms === 'string') return { reason: terms }
        if (sale.shares > terms.maximumShares)
            return { reason: 'The sale exceeds the per-turn sale limit.' }
        const company = getCompany(projected, sale.companyId)
        assertExists(company.shareCount, 'Traded company requires a share count')
        const owned = sharesOwned(projected, company.id, seller)
        if (sale.shares > owned) return { reason: 'The seller does not own enough shares.' }
        const pool = projected.certificatePools.find((pool) => pool.id === terms.destinationPoolId)
        assertExists(pool, 'Missing sale destination pool')
        const marketShares = projected.certificates.reduce(
            (sum, certificate) =>
                sum +
                (!certificate.retired &&
                certificate.kind === 'share' &&
                certificate.companyId === company.id &&
                certificate.poolId === pool.id
                    ? certificate.shares
                    : 0),
            0
        )
        if ((marketShares + sale.shares) * 100 > terms.marketLimit * company.shareCount)
            return { reason: 'The Market cannot hold that many shares.' }
        const presidency = evaluatePresidency(
            projected,
            company.id,
            rules.presidencyCandidates(projected, company.id),
            { owner: seller, shares: owned - sale.shares }
        )
        if (presidency.reason) return { reason: presidency.reason }
        if (presidency.change) applyPresidencyChange(projected, presidency.change)
        const certificateIds = certificatesForShares(
            certificatesOwnedBy(projected, seller),
            company.id,
            sale.shares
        )
        if (!certificateIds)
            return {
                reason: 'The president’s certificate cannot be sold without an eligible successor.'
            }
        const from = companyMarketSpace(projected.stockMarket, company.id)
        const to = moveMarketSpace(projected.stockMarket, from.id, terms.direction, terms.movement)
        const proceeds = terms.price * sale.shares
        const settlement: ShareSaleSettlement = {
            ...sale,
            certificateIds,
            destinationPoolId: pool.id,
            price: terms.price,
            proceeds,
            fromMarketSpaceId: from.id,
            toMarketSpaceId: to.id,
            ...(presidency.change ? { presidency: presidency.change } : {})
        }
        transferSaleCertificates(projected, settlement)
        placeStockMarker(projected.stockMarket, company.id, to.id)
        settlements.push(settlement)
        payments.push({ from: terms.payer, to: seller, amount: proceeds })
    }
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0)
    for (const payment of payments) {
        const cash = cashOwnedBy(state, payment.from)
        assertExists(cash, 'Sale payer requires cash')
        const owed = payments
            .filter((other) => sameOwner(other.from, payment.from))
            .reduce((sum, other) => sum + other.amount, 0)
        if (
            cash !== 'unlimited' &&
            cash < owed &&
            !(payment.from.kind === 'bank' && state.bank.unlimitedAfterExhaustion)
        )
            return { reason: 'The payer cannot fund this sale.' }
    }
    return { details: { seller, sales: settlements, payments, proceeds: total } }
}
export function transferSaleCertificates(state: StockState, sale: ShareSaleSettlement): void {
    const pool = state.certificatePools.find((pool) => pool.id === sale.destinationPoolId)
    assertExists(pool, 'Missing sale pool')
    for (const id of sale.certificateIds) {
        const certificate = state.certificates.find((certificate) => certificate.id === id)
        assert(certificate && !certificate.retired, 'Missing sold certificate')
        certificate.owner = pool.owner
        certificate.poolId = pool.id
    }
}

export function applyShareSale(state: StockState, details: ShareSaleDetails): void {
    settleCashPayments(state, details.payments)
    for (const sale of details.sales) {
        if (sale.presidency) applyPresidencyChange(state, sale.presidency)
        transferSaleCertificates(state, sale)
        placeStockMarker(state.stockMarket, sale.companyId, sale.toMarketSpaceId)
    }
}

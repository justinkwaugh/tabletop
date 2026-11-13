import { companyShareCount } from '../company/companyCharters.js'
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
import { placeStockMarker, stockMarkerStackIndex } from './stockMarket.js'
import { copyStockState, type StockState } from './stockState.js'
import { type StockRules, exceedsStockLimits, presidencyExchangeTerms } from './stockRules.js'
import type { SaleBlockTerms } from './stockTurn.js'

export const ShareSale = Type.Object(
    { companyId: Type.String(), shares: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type ShareSale = Type.Static<typeof ShareSale>
export type SaleRequest = { playerId: string; seller: Owner; sales: ShareSale[] }
export const PresidencyLapse = Type.Object(
    { previous: Owner, takenCertificateIds: Type.Array(Type.String()) },
    { additionalProperties: false }
)
export type PresidencyLapse = Type.Static<typeof PresidencyLapse>
export const ShareSaleSettlement = Type.Object(
    {
        ...ShareSale.properties,
        certificateIds: Type.Array(Type.String()),
        destinationPoolId: Type.String(),
        price: Type.Integer({ minimum: 1 }),
        proceeds: Type.Integer({ minimum: 1 }),
        fromMarketSpaceId: Type.String(),
        /** The company's place in its space's stack before the sale, from the top. */
        fromStackIndex: Type.Optional(Type.Integer({ minimum: 0 })),
        toMarketSpaceId: Type.String(),
        presidency: Type.Optional(PresidencyChange),
        /** The president's certificate went to the pool with no successor (1862 §6.3). */
        lapse: Type.Optional(PresidencyLapse)
    },
    { additionalProperties: false }
)
export type ShareSaleSettlement = Type.Static<typeof ShareSaleSettlement>

/**
 * A president selling below the president's certificate with no one to succeed them, where the
 * title lets the presidency lapse: the certificate goes to the pool, and the seller keeps the
 * rest of their holding in ordinary certificates, taking from the pool what they lack.
 */
export function presidencyLapse(
    state: StockState,
    companyId: string,
    seller: Owner,
    kept: number,
    poolId: string
): { soldCertificateIds: string[]; lapse: PresidencyLapse } | undefined {
    const company = getCompany(state, companyId)
    if (!company.president || !sameOwner(company.president, seller)) return undefined
    const owned = certificatesOwnedBy(state, seller).filter(
        (certificate) => certificate.kind === 'share' && certificate.companyId === companyId
    )
    const president = owned.find(
        (certificate) => certificate.kind === 'share' && certificate.president
    )
    if (!president || president.kind !== 'share' || kept >= president.shares) return undefined
    const ordinary = owned.filter((certificate) => certificate !== president)
    const keptIds = certificatesForShares(ordinary, companyId, Math.min(kept, sharesOf(ordinary)))
    if (!keptIds) return undefined
    const pooled = state.certificates.filter(
        (certificate) =>
            certificate.kind === 'share' &&
            !certificate.president &&
            certificate.companyId === companyId &&
            certificate.poolId === poolId
    )
    const taken = certificatesForShares(
        pooled,
        companyId,
        kept - sharesOf(ordinary.filter((c) => keptIds.includes(c.id)))
    )
    if (!taken) return undefined
    return {
        soldCertificateIds: [
            president.id,
            ...ordinary.filter((certificate) => !keptIds.includes(certificate.id)).map((c) => c.id)
        ],
        lapse: { previous: company.president, takenCertificateIds: taken }
    }
}

function sharesOf(certificates: readonly { kind: string; shares?: number }[]): number {
    return certificates.reduce((sum, certificate) => sum + (certificate.shares ?? 0), 0)
}
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
    { details: ShareSaleDetails; reason?: never } | { details?: never; reason: string }

export function hasLegalShareSale(
    state: StockState,
    playerId: string,
    seller: Owner,
    rules: StockRules
): boolean {
    return state.companies.some((company) => {
        for (let shares = 1; shares <= sharesOwned(state, company.id, seller); shares++) {
            if (
                evaluateShareSale(
                    state,
                    {
                        playerId,
                        seller,
                        sales: [{ companyId: company.id, shares }]
                    },
                    rules
                ).details
            )
                return true
        }
        return false
    })
}

export function mustSellShares(state: StockState, playerId: string, rules: StockRules): boolean {
    const owner: Owner = { kind: 'player', playerId }
    return (
        exceedsStockLimits(state, owner, rules) && hasLegalShareSale(state, playerId, owner, rules)
    )
}

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
    if (
        turn.bought &&
        (rules.turnOrder === 'sell-buy' ||
            (rules.turnOrder === 'sell-buy-or-buy-sell' && turn.soldBeforeBuying))
    )
        return { reason: 'Selling is not allowed after this purchase.' }
    const previous = turn.saleBlocks?.find(
        (block) => block.companyId === sales[0].companyId && sameOwner(block.seller, seller)
    )
    const extending = rules.repeatSales === 'extend-block'
    if (
        turn.companiesSold.includes(sales[0].companyId) &&
        rules.repeatSales !== 'separate' &&
        (!extending || !previous)
    )
        return { reason: 'Sell a company’s shares in one block per turn.' }
    if (!previous || !extending) return evaluateShareDisposal(state, seller, sales, rules)
    return evaluateShareDisposal(state, seller, sales, {
        market: rules.market,
        charters: rules.charters,
        presidencyCandidates: rules.presidencyCandidates,
        holdsMarketMove: rules.holdsMarketMove,
        saleTerms: extendingSaleTerms(rules.saleTerms, previous)
    })
}

/**
 * Terms for selling more of a company as part of an earlier block: at the block's price, within
 * its limit, moving the marker only as far as the larger block would beyond the earlier one.
 */
export function extendingSaleTerms(
    saleTerms: StockRules['saleTerms'],
    previous: SaleBlockTerms
): StockRules['saleTerms'] {
    return (state, companyId, shares, seller) => {
        const terms = saleTerms(state, companyId, previous.shares + shares, seller)
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
}

/** A company's sale block once a sale, before it settles, starts or extends it. */
export function saleBlockAfter(
    state: StockState,
    saleTerms: StockRules['saleTerms'],
    seller: Owner,
    sale: ShareSaleSettlement,
    previous?: SaleBlockTerms
): SaleBlockTerms {
    const shares = (previous?.shares ?? 0) + sale.shares
    const terms = saleTerms(state, sale.companyId, shares, seller)
    assert(typeof terms !== 'string', 'A legal sale requires sale terms')
    return {
        shares,
        price: previous?.price ?? sale.price,
        movement: Math.max(previous?.movement ?? 0, terms.movement),
        direction: terms.direction
    }
}

export function evaluateShareDisposal(
    state: StockState,
    seller: Owner,
    sales: ShareSale[],
    rules: Pick<
        StockRules,
        | 'market'
        | 'charters'
        | 'saleTerms'
        | 'presidencyCandidates'
        | 'presidencyExchange'
        | 'holdsMarketMove'
        | 'presidencyLapses'
    >
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
        const shareCount = companyShareCount(projected, rules.charters, company.id)
        assertExists(shareCount, 'Traded company requires a share count')
        const owned = sharesOwned(projected, company.id, seller)
        if (sale.shares > owned) return { reason: 'The seller does not own enough shares.' }
        const pool = projected.certificatePools.find((pool) => pool.id === terms.destinationPoolId)
        assertExists(pool, 'Missing sale destination pool')
        const marketShares = projected.certificates.reduce(
            (sum, certificate) =>
                sum +
                (certificate.kind === 'share' &&
                certificate.companyId === company.id &&
                certificate.poolId === pool.id
                    ? certificate.shares
                    : 0),
            0
        )
        if ((marketShares + sale.shares) * 100 > terms.marketLimit * shareCount)
            return { reason: 'The Market cannot hold that many shares.' }
        const presidency = evaluatePresidency(
            projected,
            company.id,
            rules.presidencyCandidates(projected, company.id),
            { owner: seller, shares: owned - sale.shares },
            presidencyExchangeTerms(rules)
        )
        const lapsed =
            presidency.reason && rules.presidencyLapses
                ? presidencyLapse(projected, company.id, seller, owned - sale.shares, pool.id)
                : undefined
        if (presidency.reason && !lapsed) return { reason: presidency.reason }
        if (presidency.change) applyPresidencyChange(projected, presidency.change)
        const certificateIds =
            lapsed?.soldCertificateIds ??
            certificatesForShares(certificatesOwnedBy(projected, seller), company.id, sale.shares)
        if (!certificateIds)
            return {
                reason: 'The president’s certificate cannot be sold without an eligible successor.'
            }
        const from = rules.market.companySpace(projected.stockMarket, company.id)
        const fromStackIndex = stockMarkerStackIndex(projected.stockMarket, company.id)
        const to = rules.market.move(from.id, terms.direction, terms.movement)
        const proceeds = terms.price * sale.shares
        const settlement: ShareSaleSettlement = {
            ...sale,
            certificateIds,
            destinationPoolId: pool.id,
            price: terms.price,
            proceeds,
            fromMarketSpaceId: from.id,
            fromStackIndex,
            toMarketSpaceId: to.id,
            ...(presidency.change ? { presidency: presidency.change } : {}),
            ...(lapsed ? { lapse: lapsed.lapse } : {})
        }
        transferSaleCertificates(projected, settlement)
        if (rules.holdsMarketMove?.(projected, settlement, seller))
            settlement.toMarketSpaceId = from.id
        placeStockMarker(projected.stockMarket, company.id, settlement.toMarketSpaceId)
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
        if (cash !== 'unlimited' && cash < owed && payment.from.kind !== 'bank')
            return { reason: 'The payer cannot fund this sale.' }
    }
    return { details: { seller, sales: settlements, payments, proceeds: total } }
}
export function transferSaleCertificates(state: StockState, sale: ShareSaleSettlement): void {
    const pool = state.certificatePools.find((pool) => pool.id === sale.destinationPoolId)
    assertExists(pool, 'Missing sale pool')
    for (const id of sale.certificateIds) {
        const certificate = state.certificates.find((certificate) => certificate.id === id)
        assert(certificate, 'Missing sold certificate')
        certificate.owner = pool.owner
        certificate.poolId = pool.id
    }
    if (!sale.lapse) return
    for (const id of sale.lapse.takenCertificateIds) {
        const certificate = state.certificates.find((certificate) => certificate.id === id)
        assert(certificate, 'Missing exchanged certificate')
        certificate.owner = sale.lapse.previous
        delete certificate.poolId
    }
    delete getCompany(state, sale.companyId).president
}

export function applyShareSale(state: StockState, details: ShareSaleDetails): void {
    settleCashPayments(state, details.payments)
    for (const sale of details.sales) {
        if (sale.presidency) applyPresidencyChange(state, sale.presidency)
        transferSaleCertificates(state, sale)
        placeStockMarker(state.stockMarket, sale.companyId, sale.toMarketSpaceId)
    }
}

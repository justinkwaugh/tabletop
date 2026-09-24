import {
    cashOwnedBy,
    getCompany,
    sharesOwned,
    type CertificatePool,
    type OpenShare,
    type Owner
} from '../finance/finance.js'
import { evaluateSharePurchase, type PurchaseRequest } from './sharePurchase.js'
import {
    certificateLimitAllows,
    purchasableShares,
    purchaseOwnershipCeiling,
    type StockRules
} from './stockRules.js'
import type { StockState } from './stockState.js'
import type {
    StandingStockInstruction,
    StockInstruction,
    StockInstructionStopReason
} from './stockInstruction.js'
import { stockPositionChange } from './stockInstructionSnapshot.js'

export type StockInstructionOutcome =
    | { kind: 'wait' }
    | { kind: 'pass' }
    | { kind: 'buy'; request: PurchaseRequest; price: number }
    | { kind: 'stop'; reason: StockInstructionStopReason; replacement?: StockInstruction }

function stop(
    reason: StockInstructionStopReason,
    replacement?: StockInstruction
): StockInstructionOutcome {
    return replacement ? { kind: 'stop', reason, replacement } : { kind: 'stop', reason }
}

export function evaluateStockInstruction(
    state: StockState,
    standing: StandingStockInstruction,
    rules: StockRules,
    availableActions: readonly string[]
): StockInstructionOutcome {
    if (availableActions.length === 0) return { kind: 'wait' }
    const change = stockPositionChange(state, standing, rules)
    if (change) return stop(change)
    const canPass = availableActions.includes('FinishStockTurn')
    const { instruction, playerId } = standing
    if (instruction.kind === 'pass')
        return canPass ? { kind: 'pass' } : stop({ code: 'cannot-finish' })
    const company = getCompany(state, instruction.companyId)
    const owner: Owner = { kind: 'player', playerId }
    const followUp = instruction.thenPass ? { kind: 'pass' as const } : undefined
    if (instruction.until.kind === 'floated' && company.floated)
        return stop({ code: 'goal-met', companyId: company.id }, followUp)
    if (
        instruction.until.kind === 'shares' &&
        sharesOwned(state, company.id, owner) >= instruction.until.count
    )
        return stop({ code: 'goal-met', companyId: company.id }, followUp)
    if (state.stockRound.turn.bought)
        return canPass ? { kind: 'pass' } : stop({ code: 'cannot-finish' })
    const offers = state.certificatePools
        .toSorted((left, right) =>
            left.id === instruction.preferredPoolId
                ? -1
                : right.id === instruction.preferredPoolId
                  ? 1
                  : 0
        )
        .flatMap((pool) => {
            const shares = purchasableShares(state, pool.id, company.id, owner, rules)
            return shares.length ? [{ pool, shares }] : []
        })
    if (offers.length === 0) return stop({ code: 'no-shares', companyId: company.id })
    const evaluated = offers.map(({ pool, shares }): PoolOffer => {
        if (new Set(shares.map((share) => share.certificate.shares)).size > 1)
            return {
                pool,
                reason: { code: 'mixed-certificates', companyId: company.id, poolId: pool.id }
            }
        const [{ certificate }] = shares
        const request = { playerId, buyer: owner, certificateId: certificate.id }
        const result = evaluateSharePurchase(state, request, rules)
        return result.details
            ? { pool, request, price: result.details.price }
            : { pool, reason: purchaseRejection(state, certificate, owner, rules, pool.id) }
    })
    const preferred = evaluated.find((offer) => offer.pool.id === instruction.preferredPoolId)
    if (preferred) return 'reason' in preferred ? stop(preferred.reason) : purchase(preferred)
    const fallback = evaluated
        .flatMap((offer) => ('reason' in offer ? [] : [offer]))
        .reduce<
            PurchaseOffer | undefined
        >((best, offer) => (best && best.price <= offer.price ? best : offer), undefined)
    if (fallback) return purchase(fallback)
    const failure = evaluated[0]
    return stop('reason' in failure ? failure.reason : { code: 'no-shares', companyId: company.id })
}

function purchaseRejection(
    state: StockState,
    certificate: OpenShare,
    owner: Owner,
    rules: StockRules,
    poolId: string
): StockInstructionStopReason {
    const companyId = certificate.companyId
    const terms = rules.purchaseTerms(state, certificate, owner)
    if (typeof terms === 'string') return { code: 'purchase-rejected', companyId, poolId }
    if (
        sharesOwned(state, companyId, owner) + certificate.shares >
        purchaseOwnershipCeiling(state, companyId, owner, rules)
    )
        return { code: 'ownership-limit', companyId }
    if (!certificateLimitAllows(state, owner, certificate, rules))
        return { code: 'certificate-limit', companyId }
    const cash = cashOwnedBy(state, owner)
    if (typeof cash === 'number' && cash < terms.price) return { code: 'cannot-afford', companyId }
    return { code: 'purchase-rejected', companyId, poolId }
}

type PurchaseOffer = { pool: CertificatePool; request: PurchaseRequest; price: number }
type PoolOffer = PurchaseOffer | { pool: CertificatePool; reason: StockInstructionStopReason }

function purchase(offer: PurchaseOffer): StockInstructionOutcome {
    return { kind: 'buy', request: offer.request, price: offer.price }
}

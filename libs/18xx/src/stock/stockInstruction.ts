import * as Type from 'typebox'
import {
    President,
    certificatesInPool,
    getCompany,
    sameOwner,
    sharesOwned,
    type Owner
} from '../finance/finance.js'
import { evaluateSharePurchase, type PurchaseRequest } from './sharePurchase.js'
import { exceedsStockLimits, type StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

const BuyUntil = Type.Union([
    Type.Object({ kind: Type.Literal('floated') }, { additionalProperties: false }),
    Type.Object(
        { kind: Type.Literal('shares'), count: Type.Integer({ minimum: 1 }) },
        { additionalProperties: false }
    )
])
export const StockInstruction = Type.Union([
    Type.Object({ kind: Type.Literal('pass') }, { additionalProperties: false }),
    Type.Object(
        {
            kind: Type.Literal('buy'),
            companyId: Type.String(),
            preferredPoolId: Type.String(),
            until: BuyUntil,
            thenPass: Type.Boolean()
        },
        { additionalProperties: false }
    )
])
export type StockInstruction = Type.Static<typeof StockInstruction>

export const StockPositionSnapshot = Type.Array(
    Type.Object(
        {
            companyId: Type.String(),
            started: Type.Boolean(),
            president: Type.Optional(President),
            ownerShares: Type.Integer({ minimum: 0 }),
            rivalShares: Type.Integer({ minimum: 0 }),
            bankShares: Type.Integer({ minimum: 0 })
        },
        { additionalProperties: false }
    )
)
export type StockPositionSnapshot = Type.Static<typeof StockPositionSnapshot>

export const StockInstructionTitleSnapshot = Type.Record(
    Type.String(),
    Type.Union([Type.String(), Type.Number(), Type.Boolean()])
)
export type StockInstructionTitleSnapshot = Type.Static<typeof StockInstructionTitleSnapshot>

export const StandingStockInstruction = Type.Object(
    {
        playerId: Type.String(),
        instruction: StockInstruction,
        snapshot: StockPositionSnapshot,
        titleSnapshot: Type.Optional(StockInstructionTitleSnapshot)
    },
    { additionalProperties: false }
)
export type StandingStockInstruction = Type.Static<typeof StandingStockInstruction>

const CompanyReason = <Code extends string>(code: Code) =>
    Type.Object(
        { code: Type.Literal(code), companyId: Type.String() },
        { additionalProperties: false }
    )
const PoolReason = <Code extends string>(code: Code) =>
    Type.Object(
        { code: Type.Literal(code), companyId: Type.String(), poolId: Type.String() },
        { additionalProperties: false }
    )
export const StockInstructionStopReason = Type.Union([
    Type.Object({ code: Type.Literal('limits') }, { additionalProperties: false }),
    Type.Object({ code: Type.Literal('cannot-finish') }, { additionalProperties: false }),
    CompanyReason('company-started'),
    CompanyReason('president-changed'),
    CompanyReason('shares-sold'),
    CompanyReason('presidency-threatened'),
    CompanyReason('goal-met'),
    CompanyReason('no-shares'),
    PoolReason('mixed-certificates'),
    PoolReason('purchase-rejected'),
    Type.Object(
        {
            code: Type.Literal('title'),
            key: Type.String(),
            companyId: Type.Optional(Type.String())
        },
        { additionalProperties: false }
    )
])
export type StockInstructionStopReason = Type.Static<typeof StockInstructionStopReason>

export interface StockInstructionRules {
    securePresidency?(state: StockState, companyId: string, owner: Owner): boolean
    titleSnapshot?(state: StockState, playerId: string): StockInstructionTitleSnapshot
    positionChange?(
        state: StockState,
        standing: StandingStockInstruction,
        familyChange: () => StockInstructionStopReason | undefined
    ): StockInstructionStopReason | undefined
}

export function createStandingStockInstruction(
    state: StockState,
    playerId: string,
    instruction: StockInstruction,
    rules: StockRules
): StandingStockInstruction {
    const titleSnapshot = rules.instructions?.titleSnapshot?.(state, playerId)
    return {
        playerId,
        instruction,
        snapshot: stockPositionSnapshot(state, playerId),
        ...(titleSnapshot ? { titleSnapshot } : {})
    }
}

type InstructionState = Pick<StockState, 'stockRound'>

export function standingStockInstructions(state: InstructionState): StandingStockInstruction[] {
    return state.stockRound.instructions ?? []
}

export function standingStockInstructionFor(
    state: InstructionState,
    playerId: string
): StandingStockInstruction | undefined {
    return standingStockInstructions(state).find((standing) => standing.playerId === playerId)
}

export function setStandingStockInstruction(
    state: InstructionState,
    standing: StandingStockInstruction
): void {
    state.stockRound.instructions = [
        ...standingStockInstructions(state).filter((item) => item.playerId !== standing.playerId),
        standing
    ]
}

export function removeStandingStockInstruction(state: InstructionState, playerId: string): void {
    const remaining = standingStockInstructions(state).filter(
        (standing) => standing.playerId !== playerId
    )
    if (remaining.length > 0) state.stockRound.instructions = remaining
    else delete state.stockRound.instructions
}

export function stockPositionSnapshot(state: StockState, playerId: string): StockPositionSnapshot {
    const owner: Owner = { kind: 'player', playerId }
    return state.companies.flatMap((company) => {
        if (!company.shareCount) return []
        const rivalShares = Math.max(
            0,
            ...state.players
                .filter((player) => player.playerId !== playerId)
                .map((player) =>
                    sharesOwned(state, company.id, { kind: 'player', playerId: player.playerId })
                )
        )
        return [
            {
                companyId: company.id,
                started: company.started === true,
                ...(company.president ? { president: company.president } : {}),
                ownerShares: sharesOwned(state, company.id, owner),
                rivalShares,
                bankShares: sharesOwned(state, company.id, { kind: 'bank' })
            }
        ]
    })
}

export function stockPositionChange(
    state: StockState,
    standing: StandingStockInstruction,
    rules: StockRules
): StockInstructionStopReason | undefined {
    const familyChange = () => familyPositionChange(state, standing, rules)
    return rules.instructions?.positionChange
        ? rules.instructions.positionChange(state, standing, familyChange)
        : familyChange()
}

function familyPositionChange(
    state: StockState,
    standing: StandingStockInstruction,
    rules: StockRules
): StockInstructionStopReason | undefined {
    const owner: Owner = { kind: 'player', playerId: standing.playerId }
    if (exceedsStockLimits(state, owner, rules)) return { code: 'limits' }
    for (const current of stockPositionSnapshot(state, standing.playerId)) {
        const before = standing.snapshot.find((item) => item.companyId === current.companyId)
        if (!before) continue
        const companyId = current.companyId
        if (!before.started && current.started) return { code: 'company-started', companyId }
        const presidentChanged =
            (before.president === undefined) !== (current.president === undefined) ||
            (before.president &&
                current.president &&
                !sameOwner(before.president, current.president))
        if (presidentChanged && !(current.president && sameOwner(current.president, owner)))
            return { code: 'president-changed', companyId }
        if (current.bankShares > before.bankShares) return { code: 'shares-sold', companyId }
        const presides = current.president !== undefined && sameOwner(current.president, owner)
        const secure =
            rules.instructions?.securePresidency?.(state, current.companyId, owner) ??
            current.ownerShares * 2 > (getCompany(state, current.companyId).shareCount ?? 0)
        if (presides && !secure && current.rivalShares > before.rivalShares)
            return { code: 'presidency-threatened', companyId }
    }
    return undefined
}

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
            const candidates = certificatesInPool(state, pool.id).flatMap((certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === company.id &&
                !certificate.president
                    ? [certificate]
                    : []
            )
            return candidates.length ? [{ pool, candidates }] : []
        })
    if (offers.length === 0) return stop({ code: 'no-shares', companyId: company.id })
    const evaluated = offers.map(({ pool, candidates }): PoolOffer => {
        if (new Set(candidates.map((certificate) => certificate.shares)).size > 1)
            return {
                pool,
                reason: { code: 'mixed-certificates', companyId: company.id, poolId: pool.id }
            }
        const request = { playerId, buyer: owner, certificateId: candidates[0].id }
        const result = evaluateSharePurchase(state, request, rules)
        return result.details
            ? { pool, request, price: result.details.price }
            : {
                  pool,
                  reason: { code: 'purchase-rejected', companyId: company.id, poolId: pool.id }
              }
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

type PurchaseOffer = { pool: { id: string; name: string }; request: PurchaseRequest; price: number }
type PoolOffer =
    | PurchaseOffer
    | { pool: { id: string; name: string }; reason: StockInstructionStopReason }

function purchase(offer: PurchaseOffer): StockInstructionOutcome {
    return { kind: 'buy', request: offer.request, price: offer.price }
}

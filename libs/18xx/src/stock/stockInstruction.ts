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

export const StandingStockInstruction = Type.Object(
    {
        playerId: Type.String(),
        instruction: StockInstruction,
        snapshot: StockPositionSnapshot
    },
    { additionalProperties: false }
)
export type StandingStockInstruction = Type.Static<typeof StandingStockInstruction>

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

export function describeStockPositionChange(
    state: StockState,
    standing: StandingStockInstruction,
    rules: StockRules
): string | undefined {
    const owner: Owner = { kind: 'player', playerId: standing.playerId }
    if (exceedsStockLimits(state, owner, rules)) return 'Shares must be sold to meet the limits'
    for (const current of stockPositionSnapshot(state, standing.playerId)) {
        const before = standing.snapshot.find((item) => item.companyId === current.companyId)
        if (!before) continue
        const name = getCompany(state, current.companyId).name
        if (!before.started && current.started) return `${name} was started`
        const presidentChanged =
            (before.president === undefined) !== (current.president === undefined) ||
            (before.president &&
                current.president &&
                !sameOwner(before.president, current.president))
        if (presidentChanged && !(current.president && sameOwner(current.president, owner)))
            return `${name} changed president`
        if (current.bankShares > before.bankShares) return `${name} shares were sold`
        const presides = current.president !== undefined && sameOwner(current.president, owner)
        const secure =
            current.ownerShares * 2 > (getCompany(state, current.companyId).shareCount ?? 0)
        if (presides && !secure && current.rivalShares > before.rivalShares)
            return `${name} presidency is threatened`
    }
    return undefined
}

export type StockInstructionOutcome =
    | { kind: 'wait' }
    | { kind: 'pass' }
    | { kind: 'buy'; request: PurchaseRequest; price: number }
    | { kind: 'stop'; reason: string; replacement?: StockInstruction }

function stop(reason: string, replacement?: StockInstruction): StockInstructionOutcome {
    return replacement ? { kind: 'stop', reason, replacement } : { kind: 'stop', reason }
}

export function evaluateStockInstruction(
    state: StockState,
    standing: StandingStockInstruction,
    rules: StockRules,
    availableActions: readonly string[]
): StockInstructionOutcome {
    if (availableActions.length === 0) return { kind: 'wait' }
    const change = describeStockPositionChange(state, standing, rules)
    if (change) return stop(change)
    const canPass = availableActions.includes('FinishStockTurn')
    const { instruction, playerId } = standing
    if (instruction.kind === 'pass')
        return canPass ? { kind: 'pass' } : stop('The turn cannot be finished')
    const company = getCompany(state, instruction.companyId)
    const owner: Owner = { kind: 'player', playerId }
    const followUp = instruction.thenPass ? { kind: 'pass' as const } : undefined
    if (instruction.until.kind === 'floated' && company.floated)
        return stop(`${company.name} has floated`, followUp)
    if (
        instruction.until.kind === 'shares' &&
        sharesOwned(state, company.id, owner) >= instruction.until.count
    )
        return stop(`Holding ${instruction.until.count} shares of ${company.name}`, followUp)
    if (state.stockRound.turn.bought)
        return canPass ? { kind: 'pass' } : stop('The turn cannot be finished')
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
    if (offers.length === 0) return stop(`No ${company.name} shares remain for sale`)
    const evaluated = offers.map(({ pool, candidates }): PoolOffer => {
        if (new Set(candidates.map((certificate) => certificate.shares)).size > 1)
            return {
                pool,
                reason: `${pool.name} offers ${company.name} certificates of different sizes`
            }
        const request = { playerId, buyer: owner, certificateId: candidates[0].id }
        const result = evaluateSharePurchase(state, request, rules)
        return result.details
            ? { pool, request, price: result.details.price }
            : { pool, reason: result.reason ?? 'Invalid purchase' }
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
    return stop('reason' in failure ? failure.reason : 'No purchase is available')
}

type PurchaseOffer = { pool: { id: string; name: string }; request: PurchaseRequest; price: number }
type PoolOffer = PurchaseOffer | { pool: { id: string; name: string }; reason: string }

function purchase(offer: PurchaseOffer): StockInstructionOutcome {
    return { kind: 'buy', request: offer.request, price: offer.price }
}

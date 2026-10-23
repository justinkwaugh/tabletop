import * as Type from 'typebox'
import { President, type Owner } from '../finance/finance.js'
import type { StockState } from './stockState.js'

const BuyUntil = Type.Union([
    Type.Object({ kind: Type.Literal('floated') }, { additionalProperties: false }),
    Type.Object(
        { kind: Type.Literal('shares'), count: Type.Integer({ minimum: 1 }) },
        { additionalProperties: false }
    )
])
export const ignorableStockInstructionStops = [
    'company-started',
    'president-changed',
    'shares-sold',
    'presidency-threatened'
] as const
export const IgnorableStockInstructionStop = Type.Enum(ignorableStockInstructionStops)
export type IgnorableStockInstructionStop = Type.Static<typeof IgnorableStockInstructionStop>
export const IgnoredStockInstructionStops = Type.Array(IgnorableStockInstructionStop)

export const StockInstruction = Type.Union([
    Type.Object(
        { kind: Type.Literal('pass'), ignoredStops: Type.Optional(IgnoredStockInstructionStops) },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('buy'),
            companyId: Type.String(),
            preferredPoolId: Type.String(),
            until: BuyUntil,
            thenPass: Type.Boolean(),
            ignoredStops: Type.Optional(IgnoredStockInstructionStops)
        },
        { additionalProperties: false }
    )
])
export type StockInstruction = Type.Static<typeof StockInstruction>

export function orderedIgnorableStops(
    stops: readonly IgnorableStockInstructionStop[]
): IgnorableStockInstructionStop[] {
    return ignorableStockInstructionStops.filter((stop) => stops.includes(stop))
}

export function withIgnoredStops(
    instruction: StockInstruction,
    ignoredStops: readonly IgnorableStockInstructionStop[]
): StockInstruction {
    const changed = { ...instruction }
    delete changed.ignoredStops
    const ordered = orderedIgnorableStops(ignoredStops)
    return ordered.length ? { ...changed, ignoredStops: ordered } : changed
}

export function addIgnoredStop(
    instruction: StockInstruction,
    stop: IgnorableStockInstructionStop
): IgnorableStockInstructionStop[] {
    return orderedIgnorableStops([...(instruction.ignoredStops ?? []), stop])
}

export function ignorableStop(
    reason: StockInstructionStopReason
): IgnorableStockInstructionStop | undefined {
    return ignorableStockInstructionStops.find((stop) => stop === reason.code)
}

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
    CompanyReason('cannot-afford'),
    CompanyReason('ownership-limit'),
    CompanyReason('certificate-limit'),
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

export const StandingStockInstruction = Type.Object(
    {
        playerId: Type.String(),
        instruction: StockInstruction,
        snapshot: StockPositionSnapshot,
        titleSnapshot: Type.Optional(StockInstructionTitleSnapshot),
        stopReason: Type.Optional(StockInstructionStopReason)
    },
    { additionalProperties: false }
)
export type StandingStockInstruction = Type.Static<typeof StandingStockInstruction>
export type StoppedStockInstruction = StandingStockInstruction & {
    stopReason: StockInstructionStopReason
}

export interface StockInstructionRules {
    securePresidency?(state: StockState, companyId: string, owner: Owner): boolean
    titleSnapshot?(state: StockState, playerId: string): StockInstructionTitleSnapshot
    positionChange?(
        state: StockState,
        standing: StandingStockInstruction,
        familyChange: () => StockInstructionStopReason | undefined
    ): StockInstructionStopReason | undefined
}

type InstructionState = Pick<StockState, 'stockRound'>

function declaredStockInstructions(state: InstructionState): StandingStockInstruction[] {
    return state.stockRound.instructions ?? []
}

export function declaredStockInstructionFor(
    state: InstructionState,
    playerId: string
): StandingStockInstruction | undefined {
    return declaredStockInstructions(state).find((declared) => declared.playerId === playerId)
}

export function standingStockInstructionFor(
    state: InstructionState,
    playerId: string
): StandingStockInstruction | undefined {
    const declared = declaredStockInstructionFor(state, playerId)
    return declared?.stopReason ? undefined : declared
}

export function stoppedStockInstructionFor(
    state: InstructionState,
    playerId: string
): StoppedStockInstruction | undefined {
    return declaredStockInstructions(state).find(
        (declared): declared is StoppedStockInstruction =>
            declared.playerId === playerId && declared.stopReason !== undefined
    )
}

export function setStandingStockInstruction(
    state: InstructionState,
    standing: StandingStockInstruction
): void {
    state.stockRound.instructions = [
        ...declaredStockInstructions(state).filter((item) => item.playerId !== standing.playerId),
        standing
    ]
}

export function removeStandingStockInstruction(state: InstructionState, playerId: string): void {
    const remaining = declaredStockInstructions(state).filter(
        (declared) => declared.playerId !== playerId
    )
    if (remaining.length > 0) state.stockRound.instructions = remaining
    else delete state.stockRound.instructions
}

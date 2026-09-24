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

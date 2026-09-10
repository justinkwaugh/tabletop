import type { OperatingState } from '../operating/operatingSet.js'
import * as Type from 'typebox'
import type { StockState } from '../stock/stockState.js'

export type PrivateState = StockState & OperatingState & { machineState: string }
export type PrivateExchangeTerms = {
    certificateIds: string[]
    timing: 'own-stock-turn' | 'any-turn'
    stockAction: 'additional' | 'none'
    ownershipLimit: 'ordinary' | 'exempt'
}
export const PrivateEffect = Type.Union([
    Type.Object(
        { kind: Type.Literal('close'), privateCompanyId: Type.String() },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('income'),
            privateCompanyId: Type.String(),
            revenue: Type.Integer({ minimum: 0 })
        },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('exchange'),
            privateCompanyId: Type.String(),
            certificateId: Type.String(),
            exemptOwnershipLimit: Type.Boolean()
        },
        { additionalProperties: false }
    )
])
export type PrivateEffect = Type.Static<typeof PrivateEffect>
export interface PrivateRules {
    exchangeTerms(state: PrivateState, privateCompanyId: string): PrivateExchangeTerms | undefined
    phaseEffects(state: StockState): PrivateEffect[]
    operationEffects(state: StockState, companyId: string): PrivateEffect[]
    description(state: StockState, privateCompanyId: string): string
}

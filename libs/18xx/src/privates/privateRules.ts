import type { FinancialState } from '../finance/finance.js'
import type { MapStateData } from '../map/mapState.js'
import type { OperatingState } from '../operating/operatingSet.js'
import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
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
        {
            kind: Type.Literal('close'),
            privateCompanyId: Type.String(),
            retireUnplacedPieceIds: Type.Optional(Type.Array(Type.String(), { uniqueItems: true }))
        },
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
            companyId: Type.String(),
            shares: Type.Integer({ minimum: 1 }),
            exemptOwnershipLimit: Type.Boolean()
        },
        { additionalProperties: false }
    )
])
export type PrivateEffect = Type.Static<typeof PrivateEffect>
export interface PrivateRules {
    exchangeTerms(state: PrivateState, privateCompanyId: string): PrivateExchangeTerms | undefined
    phaseEffects(state: StockState & MapStateData): PrivateEffect[]
    operationEffects(state: StockState, companyId: string): PrivateEffect[]
    description(state: StockState, privateCompanyId: string): string
    blocking?(state: PrivateHoldings, privateCompanyId: string): boolean
}
export type PrivateHoldings = Pick<FinancialState, 'companies' | 'certificates'>

export function liftedPrivateBlocks(
    markedPrivateIds: readonly string[],
    rules: Pick<PrivateRules, 'blocking'>,
    state: PrivateHoldings
): string[] {
    if (!markedPrivateIds.length) return []
    const { blocking } = rules
    assertExists(blocking, 'Map markers showing private blocks need the title to judge them')
    return markedPrivateIds.filter((privateCompanyId) => !blocking(state, privateCompanyId))
}

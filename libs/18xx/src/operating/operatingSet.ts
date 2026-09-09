import * as Type from 'typebox'
import type { StockState } from '../stock/stockState.js'

export const OperatingSet = Type.Object(
    {
        number: Type.Integer({ minimum: 1 }),
        roundNumber: Type.Integer({ minimum: 1 }),
        roundCount: Type.Integer({ minimum: 1 }),
        companyOrder: Type.Array(Type.String(), { uniqueItems: true })
    },
    { additionalProperties: false }
)
export type OperatingSet = Type.Static<typeof OperatingSet>
export type OperatingState = StockState & { operatingSet?: OperatingSet }
export interface OperatingRules {
    roundCount(state: OperatingState): number
    companyOrder(state: OperatingState): string[]
}

import * as Type from 'typebox'
import type { StockState } from '../stock/stockState.js'

export const OperatingSet = Type.Object(
    {
        number: Type.Integer({ minimum: 1 }),
        roundNumber: Type.Integer({ minimum: 1 }),
        roundCount: Type.Integer({ minimum: 1 }),
        companyOrder: Type.Array(Type.String(), { uniqueItems: true }),
        completedCompanyIds: Type.Array(Type.String(), { uniqueItems: true }),
        privateIncomePaid: Type.Boolean(),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type OperatingSet = Type.Static<typeof OperatingSet>
export type OperatingState = StockState & { operatingSet?: OperatingSet }
export interface OperatingRules {
    roundCount(state: OperatingState): number
    companyOrder(state: OperatingState): string[]
}

export function nextOperatingCompany(state: OperatingState): string | undefined {
    const set = state.operatingSet
    if (!set || set.completed) return undefined
    return set.companyOrder.find(
        (id) =>
            !set.completedCompanyIds.includes(id) &&
            state.companies.some((company) => company.id === id && !company.closed)
    )
}

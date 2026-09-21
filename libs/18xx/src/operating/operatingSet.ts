import * as Type from 'typebox'
import { assert } from '@tabletop/common'
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

export function reorderPendingOperatingCompanies(
    state: OperatingState,
    order: readonly string[]
): void {
    const set = state.operatingSet
    if (!set || set.completed) return
    const current = nextOperatingCompany(state)
    const fixed = set.companyOrder.filter(
        (id) => set.completedCompanyIds.includes(id) || id === current
    )
    const pending = set.companyOrder.filter((id) => !fixed.includes(id))
    const reordered = order.filter((id) => pending.includes(id))
    assert(reordered.length === pending.length, 'Operating order must retain every pending company')
    set.companyOrder = [...fixed, ...reordered]
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

export function validateOperatingSet(state: {
    operatingSet?: OperatingSet
    companies: readonly { id: string }[]
}): void {
    const operatingSet = state.operatingSet
    if (!operatingSet) return
    assert(
        operatingSet.roundNumber <= operatingSet.roundCount,
        'Operating round exceeds the set length'
    )
    assert(
        operatingSet.companyOrder.every((id) => state.companies.some((company) => company.id === id)),
        'Unknown operating company'
    )
    assert(
        operatingSet.completedCompanyIds.every((id) => operatingSet.companyOrder.includes(id)),
        'Completed company must belong to the operating order'
    )
}

import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import { stockMarketOrder } from '../stock/stockMarket.js'
import type { StockState } from '../stock/stockState.js'
import type { TrainState } from '../trains/train.js'

export const OperatingSet = Type.Object(
    {
        number: Type.Integer({ minimum: 1 }),
        roundNumber: Type.Integer({ minimum: 1 }),
        roundCount: Type.Integer({ minimum: 1 }),
        companyOrder: Type.Array(Type.String(), { uniqueItems: true }),
        completedCompanyIds: Type.Array(Type.String(), { uniqueItems: true }),
        privateIncomePaid: Type.Boolean(),
        exportedRound: Type.Optional(Type.Integer({ minimum: 1 })),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type OperatingSet = Type.Static<typeof OperatingSet>
export type OperatingState = StockState & { operatingSet?: OperatingSet }
export interface OperatingRules {
    roundCount(state: OperatingState): number
    companyOrder(state: OperatingState): string[]
    /** The kinds of the depot trains exported, in order, when the current operating round ends. */
    trainsToExport?(state: OperatingState & TrainState): string[]
    /** What a private pays its owner as an operating round starts, when its state decides it. */
    privateIncome?(state: OperatingState & TrainState, privateId: string): number
}

/**
 * Reorders the companies yet to operate; the next company keeps its place while it is operating,
 * unless ``betweenCompanies`` says no turn is under way.
 */
export function reorderPendingOperatingCompanies(
    state: OperatingState,
    order: readonly string[],
    { betweenCompanies = false }: { betweenCompanies?: boolean } = {}
): void {
    const set = state.operatingSet
    if (!set || set.completed) return
    const current = betweenCompanies ? undefined : nextOperatingCompany(state)
    const fixed = set.companyOrder.filter(
        (id) => set.completedCompanyIds.includes(id) || id === current
    )
    const pending = set.companyOrder.filter(
        (id) => !fixed.includes(id) && !getCompany(state, id).closed
    )
    const reordered = order.filter((id) => pending.includes(id))
    assert(reordered.length === pending.length, 'Operating order must retain every pending company')
    set.companyOrder = [...fixed, ...reordered]
}

export function nextOperatingCompany(
    state: Pick<OperatingState, 'operatingSet' | 'companies'>
): string | undefined {
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
        operatingSet.companyOrder.every((id) =>
            state.companies.some((company) => company.id === id)
        ),
        'Unknown operating company'
    )
    assert(
        operatingSet.completedCompanyIds.every((id) => operatingSet.companyOrder.includes(id)),
        'Completed company must belong to the operating order'
    )
}

export function floatedCompaniesInMarketOrder(
    state: Pick<StockState, 'companies' | 'stockMarket'>
): string[] {
    return stockMarketOrder(state.stockMarket).filter((id) => {
        const company = getCompany(state, id)
        return company.floated && !company.closed
    })
}

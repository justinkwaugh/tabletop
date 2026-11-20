import type { DestinationRunState } from '../destinations/destinationRuns.js'
import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import { getCompany, type Owner } from '../finance/finance.js'
import type { StockMarketChart } from '../stock/stockMarket.js'
import type { CompanyCharters } from '../company/companyCharters.js'
import type { StockState } from '../stock/stockState.js'
import type { TrainState } from '../trains/train.js'
import type { MapStateData } from '../map/mapState.js'

export const OperatingSet = Type.Object(
    {
        number: Type.Integer({ minimum: 1 }),
        roundNumber: Type.Integer({ minimum: 1 }),
        /** How many rounds the set holds; absent from an endless set. */
        roundCount: Type.Optional(Type.Integer({ minimum: 1 })),
        /**
         * The rounds follow one another with no count and no stock round between them, stock
         * rounds interrupting them instead, as 1880's (§IX). A set has this or a round count.
         */
        endless: Type.Optional(Type.Literal(true)),
        companyOrder: Type.Array(Type.String(), { uniqueItems: true }),
        completedCompanyIds: Type.Array(Type.String(), { uniqueItems: true }),
        privateIncomePaid: Type.Boolean(),
        /** The stock rounds that have interrupted the round under way and handed it back. */
        resumptions: Type.Optional(Type.Integer({ minimum: 1 })),
        exportedRound: Type.Optional(Type.Integer({ minimum: 1 })),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type OperatingSet = Type.Static<typeof OperatingSet>
/** How many rounds a set holds, or `endless` for rounds that never end in a set (1880 §IX). */
export type OperatingRoundCount = number | 'endless'
export function endlessOperatingSet(set: Pick<OperatingSet, 'endless'>): boolean {
    return set.endless === true
}
/** A set's round count fields: its count, or the endless mark. */
export function roundCountFields(
    count: OperatingRoundCount
): Pick<OperatingSet, 'roundCount' | 'endless'> {
    return count === 'endless' ? { endless: true } : { roundCount: count }
}
/** Whether another round of the set follows the one under way: always in an endless set. */
export function hasLaterRound(
    set: Pick<OperatingSet, 'endless' | 'roundCount' | 'roundNumber'>
): boolean {
    return set.endless === true || set.roundNumber < (set.roundCount ?? 0)
}
/** Whether the round under way is the set's last: never in an endless set. */
export function onLastRound(
    set: Pick<OperatingSet, 'endless' | 'roundCount' | 'roundNumber'>
): boolean {
    return set.endless !== true && set.roundNumber === set.roundCount
}
/**
 * The part of an endless set's round under way, one more than the stock rounds that have
 * interrupted it, as 1880 numbers OR 5.1, SR 7, OR 5.2; undefined in a set of rounds.
 */
export function operatingRoundPart(
    set: Pick<OperatingSet, 'endless' | 'resumptions'>
): number | undefined {
    return endlessOperatingSet(set) ? (set.resumptions ?? 0) + 1 : undefined
}
export type OperatingState = StockState & { operatingSet?: OperatingSet }
export interface OperatingRules {
    charters: CompanyCharters
    /** The rounds of the set starting: a count, or `endless` (1880 §IX). */
    roundCount(state: OperatingState): OperatingRoundCount
    companyOrder(state: OperatingState): string[]
    /** The kinds of the depot trains exported, in order, when the current operating round ends. */
    trainsToExport?(state: OperatingState & TrainState): string[]
    /**
     * What a private pays its owner as an operating round starts, when its state decides it,
     * such as its owner's kind or a hex's tile.
     */
    privateIncome?(
        state: OperatingState & TrainState & Pick<MapStateData, 'tileInventory'>,
        privateId: string
    ): number
    /** Who receives a private's income, when it is not simply the private's owner. */
    privateIncomeRecipient?(
        state: OperatingState & TrainState,
        privateId: string,
        owner: Owner
    ): Owner
}

/**
 * Reorders the companies yet to operate; the next company keeps its place while it is operating,
 * unless ``betweenCompanies`` says no turn is under way. With ``admitsLaterCompanies``, companies
 * new to the order that come after the operating one join the round, as companies floated in a
 * stock round interrupting it (1880 §IX).
 */
export function reorderPendingOperatingCompanies(
    state: OperatingState,
    order: readonly string[],
    {
        betweenCompanies = false,
        admitsLaterCompanies = false
    }: { betweenCompanies?: boolean; admitsLaterCompanies?: boolean } = {}
): void {
    const set = state.operatingSet
    if (!set || set.completed) return
    const current = betweenCompanies ? undefined : nextOperatingCompany(state)
    const fixed = set.companyOrder.filter(
        (id) => set.completedCompanyIds.includes(id) || id === current
    )
    const anchor = current === undefined ? -1 : order.indexOf(current)
    const admitted = admitsLaterCompanies
        ? order.filter(
              (id, index) =>
                  index > anchor && !set.companyOrder.includes(id) && !getCompany(state, id).closed
          )
        : []
    const pending = [
        ...set.companyOrder.filter((id) => !fixed.includes(id) && !getCompany(state, id).closed),
        ...admitted
    ]
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

export function actingOperatingCompany(
    state: Pick<OperatingState, 'operatingSet' | 'companies'> &
        Pick<DestinationRunState, 'destinationRun'>
): string | undefined {
    return state.destinationRun?.companyId ?? nextOperatingCompany(state)
}

export function validateOperatingSet(state: {
    operatingSet?: OperatingSet
    companies: readonly { id: string }[]
}): void {
    const operatingSet = state.operatingSet
    if (!operatingSet) return
    assert(
        (operatingSet.endless === true) !== (operatingSet.roundCount !== undefined),
        'An operating set has a round count or is endless'
    )
    assert(
        operatingSet.roundCount === undefined ||
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
    market: StockMarketChart,
    state: Pick<StockState, 'companies' | 'stockMarket'>
): string[] {
    return market.order(state.stockMarket).filter((id) => {
        const company = getCompany(state, id)
        return company.floated && !company.closed
    })
}

import { isStartCompany, type StockState } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'

export function spreadsheetCompanies(
    state: StockState,
    actions: readonly GameAction[],
    actionCount: number,
    companyOrder?: readonly string[],
    includedCompanyIds: readonly string[] = []
) {
    const isIncluded = (id: string) => includedCompanyIds.includes(id)
    const eligibleCompanies = state.companies.filter(
        (company) =>
            (company.started || isIncluded(company.id)) &&
            !company.closed &&
            (company.shareCount !== undefined ||
                state.certificates.some(
                    (certificate) =>
                        certificate.kind === 'share' && certificate.companyId === company.id
                ))
    )
    const starts = actions
        .slice(0, actionCount)
        .filter(isStartCompany)
        .map((action) => action.companyId)
    const startOrder = [
        ...eligibleCompanies
            .filter((company) => !starts.includes(company.id))
            .map((company) => company.id),
        ...starts
    ]
    const givenOrder = companyOrder ?? []
    const leftOut = startOrder.filter((id) => !givenOrder.includes(id) && !isIncluded(id))
    // Included companies hold their place at either end of the given order, as titles operate
    // them first (1846's MS and BIG4) or last (The Old Prince's PEIR).
    const lastRailway = givenOrder.findLastIndex((id) => !isIncluded(id))
    const leftOutAt = lastRailway === -1 ? givenOrder.length : lastRailway + 1
    const order = [
        ...givenOrder.slice(0, leftOutAt),
        ...leftOut,
        ...givenOrder.slice(leftOutAt),
        ...includedCompanyIds
    ]
    return eligibleCompanies.toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

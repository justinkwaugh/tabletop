import { isStartCompany, type StockState } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'

export function spreadsheetCompanies(
    state: StockState,
    actions: readonly GameAction[],
    actionCount: number,
    companyOrder?: readonly string[],
    includedCompanyIds: readonly string[] = []
) {
    const eligibleCompanies = state.companies.filter(
        (company) =>
            (company.started || includedCompanyIds.includes(company.id)) &&
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
    // A given order comes first. Companies it leaves out follow in the order they started. The
    // included companies come last, even where the given order lists them.
    const startOrder = [
        ...eligibleCompanies
            .filter((company) => !starts.includes(company.id))
            .map((company) => company.id),
        ...starts
    ]
    const notIncluded = (id: string) => !includedCompanyIds.includes(id)
    const order = [
        ...(companyOrder ?? []).filter(notIncluded),
        ...startOrder.filter(notIncluded),
        ...includedCompanyIds
    ]
    return eligibleCompanies.toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

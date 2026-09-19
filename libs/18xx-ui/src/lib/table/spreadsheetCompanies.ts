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
        (company) => (company.started || includedCompanyIds.includes(company.id)) && !company.closed &&
            (company.shareCount !== undefined || state.certificates.some(
                (certificate) => certificate.kind === 'share' && !certificate.retired &&
                    certificate.companyId === company.id
            ))
    )
    const starts = actions.slice(0, actionCount).filter(isStartCompany).map((action) => action.companyId)
    const baseOrder = companyOrder ?? [
        ...eligibleCompanies.filter((company) => !starts.includes(company.id)).map((company) => company.id),
        ...starts
    ]
    const order = [...baseOrder.filter((id) => !includedCompanyIds.includes(id)), ...includedCompanyIds]
    return eligibleCompanies.toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

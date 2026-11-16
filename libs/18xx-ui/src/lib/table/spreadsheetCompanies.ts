import {
    NationalCompanyKind,
    companyShareCount,
    isStartCompany,
    type CompanyCharters,
    type StockState
} from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'

export function spreadsheetCompanies(
    state: StockState,
    charters: CompanyCharters,
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
            // A national company, such as 1861's RSR, has no shares but runs like the rest.
            (company.kind === NationalCompanyKind || isShareCompany(state, charters, company.id))
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

/** Whether the company has shares: a charter that counts them, or certificates of them. */
function isShareCompany(state: StockState, charters: CompanyCharters, companyId: string): boolean {
    return (
        companyShareCount(state, charters, companyId) !== undefined ||
        state.certificates.some(
            (certificate) => certificate.kind === 'share' && certificate.companyId === companyId
        )
    )
}

/** The share companies no one has started that the title has on offer now, in charter order. */
export function companiesOnOffer(
    state: StockState,
    charters: CompanyCharters,
    onOffer: (companyId: string) => boolean
) {
    return state.companies.filter(
        (company) =>
            !company.started &&
            !company.closed &&
            company.kind !== 'private' &&
            company.kind !== NationalCompanyKind &&
            isShareCompany(state, charters, company.id) &&
            onOffer(company.id)
    )
}

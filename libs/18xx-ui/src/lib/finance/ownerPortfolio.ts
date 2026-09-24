import {
    cashOwnedBy,
    certificatesOwnedBy,
    getCompany,
    portfolioWealth,
    sameOwner,
    type Owner,
    type StockState,
    type ValuationRules
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'

export function ownerPortfolio(state: StockState, owner: Owner, rules: ValuationRules) {
    const cash = cashOwnedBy(state, owner)
    assert(typeof cash === 'number', 'Portfolio requires finite cash')
    const certificates = certificatesOwnedBy(state, owner)
    const companyIds = [
        ...new Set(
            certificates.filter((item) => item.kind === 'share').map((item) => item.companyId)
        )
    ]
    const ownership = companyIds.map((id) => {
        const company = getCompany(state, id)
        const shares = certificates.reduce(
            (sum, item) => sum + (item.kind === 'share' && item.companyId === id ? item.shares : 0),
            0
        )
        const total =
            company.shareCount ??
            state.certificates.reduce(
                (sum, item) =>
                    sum +
                    (!item.retired && item.kind === 'share' && item.companyId === id
                        ? item.shares
                        : 0),
                0
            )
        assert(total > 0, 'Owned shares require outstanding company shares')
        return {
            company,
            percentage: (shares / total) * 100,
            president: !!company.president && sameOwner(company.president, owner)
        }
    })
    const privates = certificates
        .filter((item) => item.kind === 'private')
        .map((item) => {
            const company = getCompany(state, item.companyId)
            return {
                company,
                income: company.closed ? 0 : (company.privateRevenue ?? 0),
                value: rules
                    .certificateItems(state, item)
                    .reduce((sum, asset) => sum + asset.value, 0)
            }
        })
        .filter((item) => !item.company.closed)
    return {
        cash,
        shares: certificates.reduce(
            (total, item) => total + (item.kind === 'share' ? item.shares : 0),
            0
        ),
        ownership: ownership.sort((a, b) => b.percentage - a.percentage),
        privates,
        netWorth: portfolioWealth(state, owner, rules).reduce((sum, item) => sum + item.value, 0)
    }
}

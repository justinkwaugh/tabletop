import {
    certificateValue,
    currentPrivateRevenue,
    getCompany,
    sharesOwned,
    type CompanyCharters,
    type StockState,
    type ValuationRules
} from '@tabletop/18xx'
import type { ownerPortfolio } from './ownerPortfolio.js'

/** A company bought whole from the bank in a hidden draft and paid for when the draft is revealed. */
export type DraftedCompany = { companyId: string; price: number }

export function draftedCost(drafted: readonly DraftedCompany[]): number {
    return drafted.reduce((sum, company) => sum + company.price, 0)
}

export function draftedCertificates(state: StockState, companyId: string) {
    return state.certificates.filter(
        (certificate) => certificate.companyId === companyId && certificate.owner.kind === 'bank'
    )
}

/** The portfolio as the reveal will leave it, so the drafting player sees what they spent. */
export function withDraftedCompanies(
    portfolio: ReturnType<typeof ownerPortfolio>,
    state: StockState,
    drafted: readonly DraftedCompany[],
    rules: ValuationRules,
    charters: CompanyCharters,
    minorsAsPrivates: boolean
) {
    const entries = drafted.map(({ companyId }) => {
        const company = getCompany(state, companyId)
        return {
            company,
            income:
                company.kind === 'private' ? currentPrivateRevenue(state, charters, companyId) : 0,
            value: draftedCertificates(state, companyId).reduce(
                (sum, certificate) => sum + certificateValue(state, certificate, rules),
                0
            )
        }
    })
    const listedAsPrivate = (entry: (typeof entries)[number]) =>
        entry.company.kind === 'private' || (minorsAsPrivates && entry.company.kind === 'minor')
    return {
        ...portfolio,
        cash: portfolio.cash - draftedCost(drafted),
        shares:
            portfolio.shares +
            entries
                .filter((entry) => !listedAsPrivate(entry))
                .reduce(
                    (sum, entry) => sum + sharesOwned(state, entry.company.id, { kind: 'bank' }),
                    0
                ),
        privates: [...portfolio.privates, ...entries.filter(listedAsPrivate)],
        netWorth: entries.reduce(
            (sum, entry) => sum + entry.value,
            portfolio.netWorth - draftedCost(drafted)
        ),
        draftedCompanyIds: drafted.map((company) => company.companyId)
    }
}

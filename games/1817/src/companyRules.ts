import { getCompany, type CompanyRules } from '@tabletop/18xx'

export const EighteenSeventeenCompanyRules: CompanyRules = {
    startMarketSpaces: () => [],
    startTerms: () => '1817 companies are started by auction.',
    // A company floats as soon as its auction is settled; its capital is the winning bid.
    flotationPayments(state, companyId) {
        const company = getCompany(state, companyId)
        return company.started && !company.floated ? [] : undefined
    }
}

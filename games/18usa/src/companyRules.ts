import { getCompany, type CompanyRules } from '@tabletop/18xx'

export const EighteenUSACompanyRules: CompanyRules = {
    startMarketSpaces: () => [],
    startTerms: () => '18USA companies are started by auction.',
    // A company floats as soon as its auction is settled (§11.6).
    flotationPayments(state, companyId) {
        const company = getCompany(state, companyId)
        return company.started && !company.floated ? [] : undefined
    }
}

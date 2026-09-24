import { assertExists } from '@tabletop/common'
import type { FinancialState } from '@tabletop/18xx'
export const TheOldPrinceCompanies = [
    { companyId: 'So', name: 'Souris', number: 1 },
    { companyId: 'A', name: 'Alberton', number: 2 },
    { companyId: 'MS', name: 'Mount Stewart', number: 3 },
    { companyId: 'MR', name: 'Murray River', number: 4 },
    { companyId: 'S', name: 'Summerside', number: 5 },
    { companyId: 'Gt', name: 'Georgetown', number: 6 },
    { companyId: 'C', name: 'Charlottetown', number: 7 }
]
export function theOldPrinceRole(state: FinancialState, role: 'mainline' | 'shortline'): string {
    const company = state.companies.find((company) => company.role === role)
    assertExists(company, `Missing ${role} company`)
    return company.id
}
export function peirCompanies(state: FinancialState) {
    return TheOldPrinceCompanies.filter((item) =>
        state.certificates.some((certificate) => certificate.id === `PEIR:share:${item.number}`)
    ).map((item) => ({ ...item, peirCertificateId: `PEIR:share:${item.number}` }))
}

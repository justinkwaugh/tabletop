import { companyCharters } from '@tabletop/18xx'
import { TheOldPrinceBranches } from './branches.js'
import { TheOldPrinceCompanies } from './companies.js'
import { TheOldPrincePrivates } from './privates.js'

export const TheOldPrinceCharters = companyCharters(() => ({
    shareCounts: Object.fromEntries([
        ...TheOldPrinceCompanies.map((company) => [company.companyId, 10]),
        ...TheOldPrinceBranches.map((branch) => [branch.id, 10]),
        ['ML', 10]
    ]),
    privateRevenues: Object.fromEntries(
        TheOldPrincePrivates.map((company) => [company.id, company.revenue])
    ),
    unsharedCompanyIds: ['PEIR']
}))

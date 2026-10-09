import { titleNames } from '@tabletop/18xx'
import { TheOldPrinceBranches } from './branches.js'
import { TheOldPrinceCompanies } from './companies.js'
import { TheOldPrincePrivates } from './privates.js'

const PoolNames: Readonly<Record<string, string>> = {
    market: 'Market',
    reserved: 'Reserved exchanges',
    auction: 'Auction'
}

export const TheOldPrinceNames = titleNames(
    Object.fromEntries([
        ...TheOldPrinceCompanies.map((company) => [company.companyId, company.name]),
        ...TheOldPrinceBranches.map((branch) => [branch.id, branch.name]),
        ['ML', 'Charlottetown'],
        ['PEIR', 'Prince Edward Island Railway'],
        ...TheOldPrincePrivates.map((company) => [company.id, company.name])
    ]),
    (poolId) => (poolId.startsWith('treasury:') ? 'Treasury shares' : PoolNames[poolId])
)

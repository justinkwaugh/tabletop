import { isTreasuryPoolId, titleNames } from '@tabletop/18xx'
import { Majors1822, Minors1822, concessionId } from './companies.js'
import { Privates1822 } from './privates.js'

export const MarketPoolId1822 = 'bank-pool'

const PoolNames: Readonly<Record<string, string>> = { [MarketPoolId1822]: 'Bank pool' }

export const Names1822 = titleNames(
    Object.fromEntries([
        ...Majors1822.map((company) => [company.id, company.name]),
        ...Minors1822.map((company) => [company.id, company.name]),
        ...Privates1822.map((company) => [company.id, company.name]),
        ...Majors1822.map((company) => [concessionId(company.id), `${company.name} concession`])
    ]),
    (poolId) => PoolNames[poolId] ?? (isTreasuryPoolId(poolId) ? 'Treasury' : undefined)
)

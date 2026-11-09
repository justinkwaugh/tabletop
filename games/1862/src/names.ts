import { titleNames } from '@tabletop/18xx'
import { Companies1862 } from './companies.js'
import { IpoPoolId, MarketPoolId } from './pools.js'

const PoolNames: Readonly<Record<string, string>> = {
    [IpoPoolId]: 'IPO',
    [MarketPoolId]: 'Bank Pool'
}

export const Names1862 = titleNames(
    Object.fromEntries(Companies1862.map((company) => [company.id, company.name])),
    (poolId) => PoolNames[poolId] ?? (poolId.startsWith('treasury:') ? 'Treasury' : undefined),
    {}
)

import { titleNames } from '@tabletop/18xx'
import { Corporations1849 } from './companies.js'
import { Privates1849 } from './privates.js'

const PoolNames: Readonly<Record<string, string>> = { 'open-market': 'Bank pool' }

const BonusNames: Readonly<Record<string, string>> = { port: '+L. 20 port token' }

export const Names1849 = titleNames(
    Object.fromEntries([
        ...Corporations1849.map((company) => [company.id, company.name]),
        ...Privates1849.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId] ?? (poolId.startsWith('treasury') ? 'Treasury' : undefined),
    BonusNames
)

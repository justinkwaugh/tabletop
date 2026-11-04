import { titleNames } from '@tabletop/18xx'
import { Companies1850 } from './companies.js'
import { Privates1850 } from './privates.js'

const PoolNames: Readonly<Record<string, string>> = {
    'initial-offering': 'IPO',
    'open-market': 'Market'
}

const BonusNames: Readonly<Record<string, string>> = { edge: 'Edge token' }

export const Names1850 = titleNames(
    Object.fromEntries([
        ...Companies1850.map((company) => [company.id, company.name]),
        ...Privates1850.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId],
    BonusNames
)

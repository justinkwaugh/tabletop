import { titleNames } from '@tabletop/18xx'
import { Companies1870 } from './companies.js'
import { Privates1870 } from './privates.js'

const PoolNames: Readonly<Record<string, string>> = {
    'initial-offering': 'IPO',
    'open-market': 'Market'
}

const BonusNames: Readonly<Record<string, string>> = {
    cattle: 'Cattle',
    port: 'Port',
    destination: 'Destination'
}

export const Names1870 = titleNames(
    Object.fromEntries([
        ...Companies1870.map((company) => [company.id, company.name]),
        ...Privates1870.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId],
    BonusNames
)

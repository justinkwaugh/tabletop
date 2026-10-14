import { titleNames } from '@tabletop/18xx'
import { EighteenThirtyMajors } from './majors.js'
import { EighteenThirtyPrivates } from './privates.js'

const PoolNames: Readonly<Record<string, string>> = {
    'initial-offering': 'IPO',
    'open-market': 'Market'
}

export const EighteenThirtyNames = titleNames(
    Object.fromEntries([
        ...Object.values(EighteenThirtyMajors).map((company) => [company.id, company.name]),
        ...EighteenThirtyPrivates.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId]
)

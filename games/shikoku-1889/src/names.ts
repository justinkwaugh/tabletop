import { titleNames } from '@tabletop/18xx'
import { Shikoku1889Majors } from './majors.js'
import { Shikoku1889Privates } from './privates.js'

const PoolNames: Readonly<Record<string, string>> = {
    'initial-offering': 'IPO',
    'open-market': 'Market'
}

export const Shikoku1889Names = titleNames(
    Object.fromEntries([
        ...Object.values(Shikoku1889Majors).map((company) => [company.id, company.name]),
        ...Shikoku1889Privates.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId]
)

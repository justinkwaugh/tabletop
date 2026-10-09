import { titleNames } from '@tabletop/18xx'
import { Corporations, DraftCompanies } from './catalog.js'

export const Names1846 = titleNames(
    Object.fromEntries(
        [...Corporations, ...DraftCompanies].map((company) => [company.id, company.name])
    ),
    (poolId) => (poolId === 'open-market' ? 'Market' : undefined)
)

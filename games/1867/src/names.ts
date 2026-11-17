import { isTreasuryPoolId, titleNames } from '@tabletop/18xx'
import { CnId, CnName, Majors1867, Minors1867 } from './companies.js'
import { Privates1867 } from './privates.js'

/** The pool shares are sold into (GTG §7.3). */
export const MarketPoolId1867 = 'open-market'
/** The route bonus for Timmins doubled with Toronto, Montreal or Quebec (GTG §8.8.2). */
export const TimminsBonusId = 'timmins'

const PoolNames: Readonly<Record<string, string>> = { [MarketPoolId1867]: 'Bank Pool' }

// Each private's $10 city bonus is named for the private (GTG §3.1).
const BonusNames: Readonly<Record<string, string>> = {
    ...Object.fromEntries(Privates1867.map((company) => [company.id, company.name])),
    [TimminsBonusId]: 'Timmins with Toronto, Montreal or Quebec'
}

export const Names1867 = titleNames(
    Object.fromEntries([
        ...Minors1867.map((company) => [company.id, company.name]),
        ...Majors1867.map((company) => [company.id, company.name]),
        ...Privates1867.map((company) => [company.id, company.name]),
        [CnId, CnName]
    ]),
    (poolId) => PoolNames[poolId] ?? (isTreasuryPoolId(poolId) ? 'Treasury' : undefined),
    BonusNames
)

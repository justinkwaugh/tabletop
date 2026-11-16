import { isTreasuryPoolId, titleNames } from '@tabletop/18xx'
import { Majors1861, Minors1861, RsrId, RsrName } from './companies.js'
import { Privates1861 } from './privates.js'

/** The pool shares are sold into (§9.1). */
export const MarketPoolId1861 = 'open-market'
/** The route bonus for Ekaterinburg doubled with Moscow (§10.6). */
export const EkaterinburgBonusId = 'ekaterinburg'

const PoolNames: Readonly<Record<string, string>> = { [MarketPoolId1861]: 'Bank Pool' }

// Each private's R10 city bonus is named for the private (§7.1).
const BonusNames: Readonly<Record<string, string>> = {
    ...Object.fromEntries(Privates1861.map((company) => [company.id, company.name])),
    [EkaterinburgBonusId]: 'Ekaterinburg with Moscow'
}

export const Names1861 = titleNames(
    Object.fromEntries([
        ...Minors1861.map((company) => [company.id, company.name]),
        ...Majors1861.map((company) => [company.id, company.name]),
        ...Privates1861.map((company) => [company.id, company.name]),
        [RsrId, RsrName]
    ]),
    (poolId) => PoolNames[poolId] ?? (isTreasuryPoolId(poolId) ? 'Treasury' : undefined),
    BonusNames
)

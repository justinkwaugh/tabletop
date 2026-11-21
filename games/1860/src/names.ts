import { titleNames } from '@tabletop/18xx'
import { Companies1860, PrivateCatalog1860 } from './companies.js'

/** The Initial Purchase Offer, where unsold shares wait at par (Setting up the Game). */
export const IpoPoolId = 'initial-offering'
/** The bank pool, where sold shares go and are bought at the market price. */
export const MarketPoolId = 'open-market'
/** Privates sold to the bank, for sale again at face value (Selling Private Companies). */
export const BankPrivatesPoolId = 'bank-privates'

const PoolNames: Readonly<Record<string, string>> = {
    [IpoPoolId]: 'IPO',
    [MarketPoolId]: 'Bank Pool',
    [BankPrivatesPoolId]: 'Bank'
}

export const Names1860 = titleNames(
    Object.fromEntries([
        ...Companies1860.map((company) => [company.id, company.name]),
        ...PrivateCatalog1860.privates.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId]
)

import { titleNames } from '@tabletop/18xx'
import { MajorsChesapeake, PrivatesChesapeake } from './companies.js'

export const IpoPoolIdChesapeake = 'initial-offering'
export const MarketPoolIdChesapeake = 'open-market'

const PoolNames: Readonly<Record<string, string>> = {
    [IpoPoolIdChesapeake]: 'IPO',
    [MarketPoolIdChesapeake]: 'Market'
}

export const NamesChesapeake = titleNames(
    Object.fromEntries([
        ...MajorsChesapeake.map((company) => [company.id, company.name]),
        ...PrivatesChesapeake.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId]
)

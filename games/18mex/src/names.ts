import { titleNames } from '@tabletop/18xx'
import { MajorsMex, MinorsMex, PrivateCatalogMex } from './companies.js'

export const IpoPoolIdMex = 'initial-offering'
export const MarketPoolIdMex = 'open-market'
/** The Initial Offering's box of trade-in certificates (2, 5.2, 5.3). */
export const TradeInPoolIdMex = 'trade-in'

const PoolNames: Readonly<Record<string, string>> = {
    [IpoPoolIdMex]: 'Initial Offering',
    [MarketPoolIdMex]: 'Open Market',
    [TradeInPoolIdMex]: 'Trade-in Shares'
}

export const NamesMex = titleNames(
    Object.fromEntries([
        ...MajorsMex.map((company) => [company.id, company.name]),
        ...MinorsMex.map((company) => [company.id, company.name]),
        ...PrivateCatalogMex.privates.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId]
)

import { titleNames } from '@tabletop/18xx'
import { Majors1828, Privates1828 } from './companies.js'
import { CobourgRailwayId } from './ids.js'

export const IpoPoolId1828 = 'initial-offering'
export const MarketPoolId1828 = 'open-market'

const PoolNames: Readonly<Record<string, string>> = {
    [IpoPoolId1828]: 'IPO',
    [MarketPoolId1828]: 'Bank pool'
}

export const Names1828 = titleNames(
    Object.fromEntries([
        ...Majors1828.map((company) => [company.id, company.name]),
        ...Privates1828.map((company) => [company.id, company.name]),
        [CobourgRailwayId, 'Cobourg & Peterborough Railway']
    ]),
    (poolId) => PoolNames[poolId]
)

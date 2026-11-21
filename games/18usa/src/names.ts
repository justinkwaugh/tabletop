import { isTreasuryPoolId, titleNames } from '@tabletop/18xx'
import { EighteenUSACorporations } from './corporations.js'
import { EighteenUSAPrivateCatalog } from './privates.js'
import { MarketPoolId } from './marketZones.js'

export const EighteenUSANames = titleNames(
    Object.fromEntries([
        ...EighteenUSACorporations.map((company) => [company.id, company.name]),
        ...EighteenUSAPrivateCatalog.privates.map((company) => [company.id, company.name])
    ]),
    (poolId) =>
        poolId === MarketPoolId ? 'Market' : isTreasuryPoolId(poolId) ? 'Treasury' : undefined
)

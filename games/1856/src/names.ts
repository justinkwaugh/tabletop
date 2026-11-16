import { titleNames } from '@tabletop/18xx'
import { CompanyNames1856 } from './companies.js'

export const IpoPoolId1856 = 'initial-offering'
export const MarketPoolId1856 = 'open-market'

const PoolNames: Readonly<Record<string, string>> = {
    [IpoPoolId1856]: 'Initial offering',
    [MarketPoolId1856]: 'Open market'
}

/** What earns a run's bonuses: the port token, and the bridge and tunnel rights. */
const BonusNames: Readonly<Record<string, string>> = {
    port: 'Port',
    bridge: 'Bridge',
    tunnel: 'Tunnel'
}

export const Names1856 = titleNames(CompanyNames1856, (poolId) => PoolNames[poolId], BonusNames)

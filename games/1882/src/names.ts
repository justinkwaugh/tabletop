import { titleNames } from '@tabletop/18xx'
import { Majors1882, Privates1882 } from './companies.js'

export const IpoPoolId1882 = 'initial-offering'
export const MarketPoolId1882 = 'open-market'
/** The route bonus for Hudson Bay with Northern Alberta or Western Canada (§11.5). */
export const HudsonBayBonusId = 'hudson-bay'

const PoolNames: Readonly<Record<string, string>> = {
    [IpoPoolId1882]: 'IPO',
    [MarketPoolId1882]: 'Bank Pool'
}

export const Names1882 = titleNames(
    Object.fromEntries([
        ...Majors1882.map((company) => [company.id, company.name]),
        ...Privates1882.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId],
    { [HudsonBayBonusId]: 'Hudson Bay' }
)

import { titleNames } from '@tabletop/18xx'
import { Corporations, DraftCompanies } from './catalog.js'
import { EastWestBonusId } from './routes.js'

export const Names1846 = titleNames(
    Object.fromEntries(
        [...Corporations, ...DraftCompanies].map((company) => [company.id, company.name])
    ),
    (poolId) => (poolId === 'open-market' ? 'Market' : undefined),
    {
        SC: 'Steamboat',
        MPC: 'Meat Packing',
        BT: 'Boomtown',
        MAIL: 'Mail Contract',
        [EastWestBonusId]: 'East–West'
    }
)

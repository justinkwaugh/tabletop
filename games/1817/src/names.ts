import { titleNames } from '@tabletop/18xx'
import { EighteenSeventeenCorporations } from './corporations.js'
import { EighteenSeventeenPrivates } from './privates.js'
import { MarketPoolId } from './roundRules.js'

export const EighteenSeventeenNames = titleNames(
    Object.fromEntries([
        ...EighteenSeventeenCorporations.map((company) => [company.id, company.name]),
        ...EighteenSeventeenPrivates.map((company) => [company.id, company.name])
    ]),
    (poolId) =>
        poolId === MarketPoolId ? 'Market' : poolId.startsWith('treasury:') ? 'Treasury' : undefined
)

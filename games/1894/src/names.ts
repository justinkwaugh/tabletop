import { titleNames } from '@tabletop/18xx'
import { EighteenNinetyFourMajors } from './majors.js'
import { EighteenNinetyFourPrivates, LondonShippingPrivateId } from './privates.js'

const PoolNames: Readonly<Record<string, string>> = {
    'initial-offering': 'IPO',
    'open-market': 'Bank pool'
}

export const EighteenNinetyFourNames = titleNames(
    Object.fromEntries([
        ...Object.values(EighteenNinetyFourMajors).map((company) => [company.id, company.name]),
        ...EighteenNinetyFourPrivates.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId],
    {
        netherlands: 'Netherlands',
        luxembourg: 'Luxembourg',
        [LondonShippingPrivateId]: 'London shipping'
    }
)

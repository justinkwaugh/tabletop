import { titleNames } from '@tabletop/18xx'
import { EighteenThirtyTwoMajors } from './majors.js'
import { EighteenThirtyTwoPrivates } from './privates.js'
import { EighteenThirtyTwoSystems } from './systems.js'

const PoolNames: Readonly<Record<string, string>> = {
    'initial-offering': 'Initial offering',
    'open-market': 'Open market'
}

export const EighteenThirtyTwoNames = titleNames(
    Object.fromEntries([
        ...Object.values(EighteenThirtyTwoMajors).map((company) => [company.id, company.name]),
        ...EighteenThirtyTwoSystems.map((system) => [system.id, system.name]),
        ...EighteenThirtyTwoPrivates.map((company) => [company.id, company.name])
    ]),
    (poolId) => PoolNames[poolId]
)

import { companyCharters } from '@tabletop/18xx'
import { EighteenThirtyTwoMajors } from './majors.js'
import { EighteenThirtyTwoPrivates } from './privates.js'
import { EighteenThirtyTwoSystems, SystemShareCount } from './systems.js'

export const EighteenThirtyTwoCharters = companyCharters(() => ({
    shareCounts: Object.fromEntries([
        ...Object.values(EighteenThirtyTwoMajors).map((company) => [company.id, 10]),
        ...EighteenThirtyTwoSystems.map((system) => [system.id, SystemShareCount])
    ]),
    privateRevenues: Object.fromEntries(
        EighteenThirtyTwoPrivates.map((company) => [company.id, company.revenue])
    )
}))

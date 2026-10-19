import { companyCharters } from '@tabletop/18xx'
import { EighteenThirtyMajors } from './majors.js'
import { EighteenThirtyPrivates } from './privates.js'

export const EighteenThirtyCharters = companyCharters(() => ({
    shareCounts: Object.fromEntries(
        Object.values(EighteenThirtyMajors).map((company) => [company.id, 10])
    ),
    privateRevenues: Object.fromEntries(
        EighteenThirtyPrivates.map((company) => [company.id, company.revenue])
    )
}))

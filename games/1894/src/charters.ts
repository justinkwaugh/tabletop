import { companyCharters } from '@tabletop/18xx'
import { EighteenNinetyFourMajors } from './majors.js'
import { EighteenNinetyFourPrivates } from './privates.js'

export const EighteenNinetyFourCharters = companyCharters(() => ({
    shareCounts: Object.fromEntries(
        Object.values(EighteenNinetyFourMajors).map((company) => [company.id, 10])
    ),
    privateRevenues: Object.fromEntries(
        EighteenNinetyFourPrivates.map((company) => [company.id, company.revenue])
    )
}))

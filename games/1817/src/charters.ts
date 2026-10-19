import { companyCharters } from '@tabletop/18xx'
import { EighteenSeventeenCorporations } from './corporations.js'
import { EighteenSeventeenPrivates } from './privates.js'

// A corporation's size is chosen as it starts and changed by conversion; until then it counts
// as the smallest, two shares.
export const EighteenSeventeenCharters = companyCharters(() => ({
    shareCounts: Object.fromEntries(
        EighteenSeventeenCorporations.map((company) => [company.id, 2])
    ),
    privateRevenues: Object.fromEntries(
        EighteenSeventeenPrivates.map((company) => [company.id, company.revenue])
    )
}))

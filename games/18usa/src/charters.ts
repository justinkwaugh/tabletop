import { companyCharters } from '@tabletop/18xx'
import { EighteenUSACorporations } from './corporations.js'
import { EighteenUSAPrivateCatalog } from './privates.js'

// A corporation's size is chosen as it starts and changed by conversion; until then it counts
// as the smallest, two shares.
export const EighteenUSACharters = companyCharters(() => ({
    shareCounts: Object.fromEntries(EighteenUSACorporations.map((company) => [company.id, 2])),
    privateRevenues: Object.fromEntries(
        EighteenUSAPrivateCatalog.privates.map((company) => [company.id, company.revenue])
    )
}))

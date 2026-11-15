import { companyCharters } from '@tabletop/18xx'
import { Shikoku1889Majors } from './majors.js'
import { Shikoku1889Privates } from './privates.js'

export const Shikoku1889Charters = companyCharters(() => ({
    shareCounts: Object.fromEntries(
        Object.values(Shikoku1889Majors).map((company) => [company.id, 10])
    ),
    privateRevenues: Object.fromEntries(
        Shikoku1889Privates.map((company) => [company.id, company.revenue])
    )
}))

import { companyCharters } from '@tabletop/18xx'
import { Corporations, DraftCompanies } from './catalog.js'

export const Charters1846 = companyCharters(() => ({
    shareCounts: Object.fromEntries([
        ...Corporations.map((company) => [company.id, 10]),
        ...DraftCompanies.flatMap((company) =>
            company.kind === 'independent' ? [[company.id, 1]] : []
        )
    ]),
    privateRevenues: Object.fromEntries(
        DraftCompanies.map((company) => [company.id, company.revenue])
    )
}))

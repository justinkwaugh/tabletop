import { companyCharters } from '@tabletop/18xx'
import { CgrId, MajorIds1856, Privates1856 } from './companies.js'

/**
 * Ten shares a company; the CGR's count rises to twenty when its exchange needs a second issue
 * (Share Exchange), recorded on the company.
 */
export const Charters1856 = companyCharters(() => ({
    shareCounts: Object.fromEntries([...MajorIds1856, CgrId].map((id) => [id, 10])),
    privateRevenues: Object.fromEntries(
        Privates1856.map((company) => [company.id, company.revenue])
    )
}))

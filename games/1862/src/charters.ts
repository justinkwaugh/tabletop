import { companyCharters } from '@tabletop/18xx'
import { CompanyIds1862 } from './companies.js'

// Every company has ten shares: the director's certificate of three and seven of one (§2.1).
export const ShareCount = 10
export const DirectorShares = 3

export const Charters1862 = companyCharters(() => ({
    shareCounts: Object.fromEntries(CompanyIds1862.map((companyId) => [companyId, ShareCount])),
    privateRevenues: {}
}))

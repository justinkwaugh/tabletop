import { assert, assertExists } from '@tabletop/common'
import { getCompany, type FinancialState } from '../finance/finance.js'

/**
 * A title's printed charters: each share company's size and each private's revenue. State
 * records a value only where play changes it, such as 1817's company sizes.
 */
export interface CompanyCharters {
    /** The company's printed share count; undefined for a company without shares. */
    shareCount(companyId: string): number | undefined
    privateRevenue(privateCompanyId: string): number
}

type CharterTables = {
    shareCounts: Readonly<Record<string, number>>
    privateRevenues: Readonly<Record<string, number>>
    /** Companies that are neither privates nor sold in shares, such as The Old Prince's PEIR. */
    unsharedCompanyIds?: readonly string[]
}

/** Built on first use, so a title's catalogs may import modules that read its charters. */
export function companyCharters(define: () => CharterTables): CompanyCharters {
    let tables: CharterTables | undefined
    const charters = () => (tables ??= define())
    return {
        shareCount(companyId) {
            const { shareCounts, privateRevenues, unsharedCompanyIds = [] } = charters()
            const shareCount = shareCounts[companyId]
            assert(
                shareCount !== undefined ||
                    companyId in privateRevenues ||
                    unsharedCompanyIds.includes(companyId),
                `Unchartered company: ${companyId}`
            )
            return shareCount
        },
        privateRevenue(privateCompanyId) {
            const revenue = charters().privateRevenues[privateCompanyId]
            assertExists(revenue, `Unchartered private company: ${privateCompanyId}`)
            return revenue
        }
    }
}

type CompanyRecords = Pick<FinancialState, 'companies'>

export function companyShareCount(
    state: CompanyRecords,
    charters: CompanyCharters,
    companyId: string
): number | undefined {
    return getCompany(state, companyId).shareCount ?? charters.shareCount(companyId)
}

/** What an open private pays its owner each operating round. */
export function currentPrivateRevenue(
    state: CompanyRecords,
    charters: CompanyCharters,
    privateCompanyId: string
): number {
    const company = getCompany(state, privateCompanyId)
    if (company.closed) return 0
    return company.privateRevenue ?? charters.privateRevenue(privateCompanyId)
}

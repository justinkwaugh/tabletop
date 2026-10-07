import type { CompanyState } from '@tabletop/18xx'
import { EighteenThirtyTwoMajors } from './majors.js'

const MajorIds: readonly string[] = Object.keys(EighteenThirtyTwoMajors)

/**
 * The certificate-limit column: the companies still active or available, from ten down to six
 * or fewer (Table 2). A closed company leaves play.
 */
export function certificateLimitColumn(state: Pick<CompanyState, 'companies'>): number {
    const remaining = state.companies.filter(
        (company) => MajorIds.includes(company.id) && !company.closed
    ).length
    return Math.min(4, Math.max(0, MajorIds.length - remaining))
}

import { assert } from '@tabletop/common'
import { getCompany, type FinancialState } from '../finance/finance.js'

export function closePrivate(state: FinancialState, companyId: string): void {
    const company = getCompany(state, companyId)
    assert(company.kind === 'private', 'Only private companies use this closure procedure')
    company.closed = true
    company.privateRevenue = 0
    state.certificates = state.certificates.map((certificate) => {
        if (certificate.companyId !== companyId || certificate.retired) return certificate
        const { owner: _owner, poolId: _poolId, ...interest } = certificate
        return { ...interest, retired: true }
    })
}

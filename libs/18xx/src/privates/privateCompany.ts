import { assert } from '@tabletop/common'
import { getCompany, privateOwner, type FinancialState } from '../finance/finance.js'

/** The company owning the private while it is open; a private does nothing for a player. */
export function privateOwningCompany(state: FinancialState, privateId: string): string | undefined {
    const owner = privateOwner(state, privateId)
    return owner?.kind === 'company' && !getCompany(state, privateId).closed
        ? owner.companyId
        : undefined
}

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

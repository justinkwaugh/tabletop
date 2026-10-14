import { assert } from '@tabletop/common'
import {
    getCompany,
    privateOwner,
    removeCertificates,
    type FinancialState
} from '../finance/finance.js'

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
    removeCertificates(
        state,
        state.certificates
            .filter((certificate) => certificate.companyId === companyId)
            .map((certificate) => certificate.id)
    )
}

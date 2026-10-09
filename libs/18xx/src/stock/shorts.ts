import { assert } from '@tabletop/common'
import {
    issueShareCertificates,
    nextIssuedNumber,
    removeCertificates,
    sameOwner,
    type CertificatePool,
    type FinancialState,
    type OpenShare,
    type OpenShort,
    type Owner
} from '../finance/finance.js'

export function openShorts(
    state: Pick<FinancialState, 'certificates'>,
    companyId: string,
    owner?: Owner
): OpenShort[] {
    return state.certificates.flatMap((certificate) =>
        certificate.kind === 'short' &&
        certificate.companyId === companyId &&
        (!owner || sameOwner(certificate.owner, owner))
            ? [certificate]
            : []
    )
}

/** The company's single shares other than the president's, which a short can close against. */
export function ordinaryShares(
    state: Pick<FinancialState, 'certificates'>,
    companyId: string
): OpenShare[] {
    return state.certificates.flatMap((certificate) =>
        certificate.kind === 'share' &&
        !certificate.president &&
        certificate.shares === 1 &&
        certificate.companyId === companyId
            ? [certificate]
            : []
    )
}

export function retireCertificates(state: FinancialState, ids: readonly string[]): void {
    assert(
        ids.every((id) => state.certificates.some((certificate) => certificate.id === id)),
        'Only an outstanding certificate is retired'
    )
    removeCertificates(state, ids)
}

/**
 * Opens a short: a new share of the company goes to the market pool and the holder takes the
 * matching short. Paying the holder is the title's affair.
 */
export function openShort(
    state: FinancialState,
    companyId: string,
    holder: Owner,
    market: CertificatePool
): { shareId: string; shortId: string } {
    const [shareId] = issueShareCertificates(state, companyId, 1, {
        owner: { ...market.owner },
        poolId: market.id
    })
    return { shareId, shortId: addShort(state, companyId, holder) }
}

/** Gives the holder a short of the company without issuing its market share. */
export function addShort(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    companyId: string,
    holder: Owner,
    poolId?: string
): string {
    const prefix = `${companyId}:short:`
    const id = `${prefix}${nextIssuedNumber(
        state,
        companyId,
        state.certificates.map((certificate) => certificate.id),
        prefix
    )}`
    state.certificates.push({
        id,
        companyId,
        kind: 'short',
        shares: 1,
        owner: { ...holder },
        ...(poolId ? { poolId } : {})
    })
    return id
}

/** Retires each of the owner's shorts of the company against one of its ordinary shares. */
export function cancelShorts(state: FinancialState, companyId: string, owner: Owner): number {
    const shorts = openShorts(state, companyId, owner)
    const shares = ordinaryShares(state, companyId).filter((share) => sameOwner(share.owner, owner))
    const pairs = Math.min(shorts.length, shares.length)
    retireCertificates(state, [
        ...shorts.slice(0, pairs).map((short) => short.id),
        ...shares.slice(0, pairs).map((share) => share.id)
    ])
    return pairs
}

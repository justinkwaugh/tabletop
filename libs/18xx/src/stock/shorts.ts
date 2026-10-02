import { assert } from '@tabletop/common'
import {
    issueShareCertificates,
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
        !certificate.retired &&
        certificate.kind === 'short' &&
        certificate.companyId === companyId &&
        (!owner || sameOwner(certificate.owner, owner))
            ? [certificate]
            : []
    )
}

/** Retires certificates that leave play, such as a short and the share that closes it. */
export function retireCertificates(state: FinancialState, ids: readonly string[]): void {
    state.certificates = state.certificates.map((certificate) => {
        if (!ids.includes(certificate.id)) return certificate
        assert(!certificate.retired, 'Only an outstanding certificate is retired')
        const { owner: _owner, poolId: _poolId, ...interest } = certificate
        return { ...interest, retired: true }
    })
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
    const before = new Set(state.certificates.map((certificate) => certificate.id))
    issueShareCertificates(state, companyId, 1, { owner: { ...market.owner }, poolId: market.id })
    const share = state.certificates.find((certificate) => !before.has(certificate.id))
    assert(share, 'Opening a short issues a share')
    const numbers = state.certificates.flatMap((certificate) =>
        certificate.id.startsWith(`${companyId}:short:`)
            ? [Number(certificate.id.slice(`${companyId}:short:`.length))]
            : []
    )
    const shortId = `${companyId}:short:${Math.max(0, ...numbers) + 1}`
    state.certificates.push({
        id: shortId,
        companyId,
        kind: 'short',
        shares: 1,
        certificateLimitCount: 0,
        retired: false,
        owner: { ...holder }
    })
    return { shareId: share.id, shortId }
}

/** Retires each of the owner's shorts of the company against one of its ordinary shares. */
export function cancelShorts(state: FinancialState, companyId: string, owner: Owner): number {
    const shorts = openShorts(state, companyId, owner)
    const shares = state.certificates.filter(
        (certificate): certificate is OpenShare =>
            !certificate.retired &&
            certificate.kind === 'share' &&
            !certificate.president &&
            certificate.shares === 1 &&
            certificate.companyId === companyId &&
            sameOwner(certificate.owner, owner)
    )
    const pairs = Math.min(shorts.length, shares.length)
    retireCertificates(state, [
        ...shorts.slice(0, pairs).map((short) => short.id),
        ...shares.slice(0, pairs).map((share) => share.id)
    ])
    return pairs
}
